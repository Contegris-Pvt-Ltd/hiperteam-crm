// ============================================================
// FILE: apps/api/src/modules/calendar-sync/calendar-sync.controller.ts
// ============================================================

import {
  Controller, Get, Post, Delete, Query, Request,
  UseGuards, Res, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CalendarSyncService } from './calendar-sync.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Calendar Sync')
@Controller('calendar-sync')
export class CalendarSyncController {
  private readonly logger = new Logger(CalendarSyncController.name);

  constructor(
    private calendarSyncService: CalendarSyncService,
    private configService: ConfigService,
  ) {}

  // ============================================================
  // OAuth Flow
  // ============================================================

  /**
   * Step 1: Redirect user to Google OAuth consent screen
   */
  @Get('google/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Google OAuth URL' })
  async getGoogleAuthUrl(@Request() req: { user: JwtPayload }) {
    const url = this.calendarSyncService.getGoogleAuthUrl(
      req.user.sub,
      req.user.tenantSchema,
    );
    return { url };
  }

  /**
   * Step 2: Google redirects back here with authorization code.
   * This is NOT behind JwtAuthGuard because the browser redirects here directly.
   * We use the encoded state param to identify the user.
   */
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl')
      || this.configService.get<string>('FRONTEND_URL')
      || 'http://localhost:5173';

    if (error) {
      this.logger.warn(`Google OAuth error: ${error}`);
      return res.redirect(`${frontendUrl}/tasks?calendar=error&reason=${error}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/tasks?calendar=error&reason=missing_params`);
    }

    try {
      await this.calendarSyncService.handleGoogleCallback(code, state);
      return res.redirect(`${frontendUrl}/tasks?calendar=connected`);
    } catch (err: any) {
      this.logger.error(`Google callback failed: ${err.message}`);
      return res.redirect(`${frontendUrl}/tasks?calendar=error&reason=callback_failed`);
    }
  }

  // ============================================================
  // Connection Management
  // ============================================================

  @Get('connection')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user calendar connection status' })
  async getConnection(@Request() req: { user: JwtPayload }) {
    const conn = await this.calendarSyncService.getConnection(
      req.user.tenantSchema, req.user.sub,
    );
    return { connected: !!conn, connection: conn };
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Google Calendar' })
  async disconnect(@Request() req: { user: JwtPayload }) {
    return this.calendarSyncService.disconnect(
      req.user.tenantSchema, req.user.sub,
    );
  }

  // ============================================================
  // Sync
  // ============================================================

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger manual sync' })
  async syncNow(@Request() req: { user: JwtPayload }) {
    return this.calendarSyncService.syncNow(
      req.user.tenantSchema, req.user.sub,
    );
  }

  // ============================================================
  // Events
  // ============================================================

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get synced Google Calendar events for a date range' })
  async getEvents(
    @Request() req: { user: JwtPayload },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      // Default: current month
      const now = new Date();
      from = from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      to = to || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    }

    return this.calendarSyncService.getGoogleEvents(
      req.user.tenantSchema, req.user.sub, from, to,
    );
  }
}