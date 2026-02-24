import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantSchema?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Will be configured per environment
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId → Set<socketId>

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // CONNECTION HANDLING
  // ============================================================
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT from handshake
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Socket ${client.id} connected without auth — disconnecting`);
        client.disconnect(true);
        return;
      }

      // Verify JWT
      const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
      const decoded = jwt.verify(token as string, jwtSecret) as any;

      client.userId = decoded.sub || decoded.userId;
      client.tenantSchema = decoded.tenantSchema;

      if (!client.userId) {
        client.disconnect(true);
        return;
      }

      // Join user-specific room
      const userRoom = `user:${client.userId}`;
      client.join(userRoom);

      // Track socket
      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      this.userSockets.get(client.userId)!.add(client.id);

      this.logger.log(`User ${client.userId} connected (socket: ${client.id})`);

      // Send unread count on connect
      await this.sendUnreadCount(client);
    } catch (err: any) {
      this.logger.warn(`Socket auth failed: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
      this.logger.log(`User ${client.userId} disconnected (socket: ${client.id})`);
    }
  }

  // ============================================================
  // CLIENT → SERVER MESSAGES
  // ============================================================

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.userId || !client.tenantSchema) return;

    await this.dataSource.query(
      `UPDATE "${client.tenantSchema}".notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [data.notificationId, client.userId],
    );

    // Broadcast updated count to all user's sockets
    await this.sendUnreadCount(client);
  }

  @SubscribeMessage('mark_all_read')
  async handleMarkAllRead(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId || !client.tenantSchema) return;

    await this.dataSource.query(
      `UPDATE "${client.tenantSchema}".notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false`,
      [client.userId],
    );

    this.emitToUser(client.userId, 'unread_count', { count: 0 });
  }

  @SubscribeMessage('dismiss')
  async handleDismiss(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.userId || !client.tenantSchema) return;

    await this.dataSource.query(
      `UPDATE "${client.tenantSchema}".notifications SET is_dismissed = true WHERE id = $1 AND user_id = $2`,
      [data.notificationId, client.userId],
    );

    await this.sendUnreadCount(client);
  }

  // ============================================================
  // SERVER → CLIENT: PUSH NOTIFICATION
  // ============================================================
  pushToUser(userId: string, notification: {
    id: string;
    type: string;
    title: string;
    body?: string;
    icon?: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string;
    createdAt: string;
  }) {
    this.emitToUser(userId, 'notification', notification);
  }

  // ============================================================
  // SERVER → CLIENT: UPDATE UNREAD COUNT
  // ============================================================
  pushUnreadCount(userId: string, count: number) {
    this.emitToUser(userId, 'unread_count', { count });
  }

  // ============================================================
  // CHECK IF USER IS ONLINE
  // ============================================================
  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  // ============================================================
  // GET ONLINE USER COUNT
  // ============================================================
  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================
  private emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  private async sendUnreadCount(client: AuthenticatedSocket) {
    if (!client.userId || !client.tenantSchema) return;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${client.tenantSchema}".notifications WHERE user_id = $1 AND is_read = false AND is_dismissed = false`,
      [client.userId],
    );

    this.emitToUser(client.userId, 'unread_count', { count: parseInt(count, 10) });
  }
}