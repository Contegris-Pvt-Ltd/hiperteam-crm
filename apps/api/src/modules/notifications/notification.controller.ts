import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  Request, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import { BrowserPushChannel } from './channels/browser-push.channel';
import { EmailChannel } from './channels/email.channel';
import { SmsWhatsAppChannel } from './channels/sms-whatsapp.channel';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private preferencesService: NotificationPreferencesService,
    private templateService: NotificationTemplateService,
    private browserPushChannel: BrowserPushChannel,
    private emailChannel: EmailChannel,
    private smsWhatsAppChannel: SmsWhatsAppChannel,
  ) {}

  // ============================================================
  // NOTIFICATIONS (user-facing)
  // ============================================================

  @Get()
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Get my notifications' })
  async getNotifications(
    @Request() req: { user: JwtPayload },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationService.findByUser(req.user.tenantSchema, req.user.sub, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      unreadOnly: unreadOnly === 'true',
      type,
    });
  }

  @Get('unread-count')
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: { user: JwtPayload }) {
    const count = await this.notificationService.getUnreadCount(req.user.tenantSchema, req.user.sub);
    return { count };
  }

  @Put(':id/read')
  @RequirePermission('notifications', 'view')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    await this.notificationService.markRead(req.user.tenantSchema, req.user.sub, id);
  }

  @Put('read-all')
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Request() req: { user: JwtPayload }) {
    const count = await this.notificationService.markAllRead(req.user.tenantSchema, req.user.sub);
    return { markedRead: count };
  }

  @Put(':id/dismiss')
  @RequirePermission('notifications', 'view')
  @HttpCode(204)
  @ApiOperation({ summary: 'Dismiss a notification' })
  async dismiss(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    await this.notificationService.dismiss(req.user.tenantSchema, req.user.sub, id);
  }

  // ============================================================
  // PREFERENCES (user-facing)
  // ============================================================

  @Get('preferences')
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Get my notification preferences' })
  async getPreferences(@Request() req: { user: JwtPayload }) {
    return this.preferencesService.getUserPreferences(req.user.tenantSchema, req.user.sub);
  }

  @Put('preferences/:eventType')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Update preference for an event type' })
  async updatePreference(
    @Request() req: { user: JwtPayload },
    @Param('eventType') eventType: string,
    @Body() body: {
      inApp?: boolean;
      email?: boolean;
      browserPush?: boolean;
      sms?: boolean;
      whatsapp?: boolean;
    },
  ) {
    return this.preferencesService.updatePreference(
      req.user.tenantSchema, req.user.sub, eventType, body,
    );
  }

  @Put('preferences')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Bulk update notification preferences' })
  async bulkUpdatePreferences(
    @Request() req: { user: JwtPayload },
    @Body() body: {
      preferences: Array<{
        eventType: string;
        inApp?: boolean;
        email?: boolean;
        browserPush?: boolean;
        sms?: boolean;
        whatsapp?: boolean;
      }>;
    },
  ) {
    return this.preferencesService.bulkUpdate(
      req.user.tenantSchema, req.user.sub, body.preferences,
    );
  }

  // ============================================================
  // PUSH SUBSCRIPTIONS
  // ============================================================

  @Get('push/public-key')
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  async getVapidPublicKey(@Request() req: { user: JwtPayload }) {
    const key = await this.browserPushChannel.getPublicKey(req.user.tenantSchema);
    return { publicKey: key };
  }

  @Post('push/subscribe')
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Register push subscription' })
  async subscribePush(
    @Request() req: { user: JwtPayload },
    @Body() body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    return this.browserPushChannel.subscribe(
      req.user.tenantSchema, req.user.sub, body,
    );
  }

  @Delete('push/unsubscribe')
  @RequirePermission('notifications', 'view')
  @ApiOperation({ summary: 'Remove push subscription' })
  async unsubscribePush(
    @Request() req: { user: JwtPayload },
    @Body() body: { endpoint: string },
  ) {
    await this.browserPushChannel.unsubscribe(
      req.user.tenantSchema, req.user.sub, body.endpoint,
    );
    return { success: true };
  }

  // ============================================================
  // TEMPLATES (admin)
  // ============================================================

  @Get('templates')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Get all notification templates' })
  async getTemplates(@Request() req: { user: JwtPayload }) {
    return this.templateService.findAll(req.user.tenantSchema);
  }

  @Put('templates/:id')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Update a notification template' })
  async updateTemplate(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
      emailSubject?: string;
      emailBodyHtml?: string;
      emailBodyText?: string;
      smsBody?: string;
      whatsappTemplateId?: string;
      isActive?: boolean;
    },
  ) {
    return this.templateService.update(req.user.tenantSchema, id, body);
  }

  // ============================================================
  // SETTINGS (admin)
  // ============================================================

  @Get('settings')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Get notification settings' })
  async getSettings(@Request() req: { user: JwtPayload }) {
    return this.notificationService.getSettings(req.user.tenantSchema);
  }

  @Put('settings/:key')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Update a notification setting' })
  async updateSetting(
    @Request() req: { user: JwtPayload },
    @Param('key') key: string,
    @Body() body: { value: any },
  ) {
    await this.notificationService.updateSetting(req.user.tenantSchema, key, body.value);
    return { success: true };
  }

  // ============================================================
  // VERIFICATION (admin)
  // ============================================================

  @Post('verify/smtp')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Test SMTP connection' })
  async verifySmtp(@Request() req: { user: JwtPayload }) {
    try {
      return await this.emailChannel.verify(req.user.tenantSchema);
    } catch (err: any) {
      return { success: false, error: err.message || 'SMTP verification failed' };
    }
  }

  @Post('verify/twilio')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Test Twilio connection' })
  async verifyTwilio(@Request() req: { user: JwtPayload }) {
    return this.smsWhatsAppChannel.verify(req.user.tenantSchema);
  }

  @Post('push/generate-vapid')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Generate VAPID keys for push notifications' })
  async generateVapidKeys(@Request() req: { user: JwtPayload }) {
    return this.browserPushChannel.generateVapidKeys(req.user.tenantSchema);
  }

  // ============================================================
  // SEND TEST (admin)
  // ============================================================

  @Post('test')
  @RequirePermission('notifications', 'edit')
  @ApiOperation({ summary: 'Send a test notification' })
  async sendTest(
    @Request() req: { user: JwtPayload },
    @Body() body: { channel?: string; testEmail?: string },
  ) {
    try {
      const channels = body.channel
        ? [body.channel as any]
        : undefined;

      const id = await this.notificationService.notify(req.user.tenantSchema, {
        userId: req.user.sub,
        eventType: 'task_assigned',
        title: 'Test Notification',
        body: 'This is a test notification from the notification service.',
        icon: 'bell',
        actionUrl: '/tasks',
        variables: {
          assigneeName: 'You',
          taskTitle: 'Test Task',
          dueDate: new Date().toLocaleDateString(),
          priority: 'Medium',
          actionUrl: '/tasks',
        },
        forceChannels: channels,
        // Pass testEmail override — if set, email goes to this address instead of logged-in user
        testEmail: body.testEmail || undefined,
      });

      return { success: !!id, notificationId: id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send test notification' };
    }
  }
}