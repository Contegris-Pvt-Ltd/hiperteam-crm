import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EmailAccountsService } from './email-accounts.service';
import { EmailSyncService } from './email-sync.service';
import { EmailStoreService } from './email-store.service';
import { EmailSendService } from './email-send.service';
import { EmailRulesService } from './email-rules.service';
import { createHmac } from 'crypto';

// 1×1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// ── Email Controller (mixed auth: per-method guards) ──────────
@ApiTags('Email Inbox')
@ApiBearerAuth()
@Controller('email')
export class EmailInboxController {
  private readonly logger = new Logger(EmailInboxController.name);

  constructor(
    private readonly emailAccountsService: EmailAccountsService,
    private readonly emailSyncService: EmailSyncService,
    private readonly emailStoreService: EmailStoreService,
    private readonly emailSendService: EmailSendService,
    private readonly emailRulesService: EmailRulesService,
    private readonly configService: ConfigService,
  ) {}

  // ── Account Management ────────────────────────────────────

  @Get('accounts')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'view')
  async getAccounts(@Request() req: { user: JwtPayload }) {
    return this.emailAccountsService.getAccounts(req.user.tenantSchema, req.user.sub);
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'delete')
  async deleteAccount(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    await this.emailAccountsService.deleteAccount(req.user.tenantSchema, id);
    return { success: true };
  }

  // ── Gmail OAuth ───────────────────────────────────────────

  @Get('connect/gmail')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async connectGmail(
    @Request() req: { user: JwtPayload },
    @Query('isShared') isShared: string,
  ) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Gmail OAuth not configured');
    }

    const state = this.signOAuthState({
      userId: req.user.sub,
      schemaName: req.user.tenantSchema,
      isShared: isShared === 'true',
    });

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;

    return { url };
  }

  @Get('callback/gmail')
  async callbackGmail(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl')
      || this.configService.get<string>('FRONTEND_URL')
      || 'http://localhost:5173';

    if (error || !code) {
      return res.redirect(`${frontendUrl}/settings/email?connected=error`);
    }

    const parsed = this.verifyOAuthState(state);
    if (!parsed) {
      return res.redirect(`${frontendUrl}/settings/email?connected=error`);
    }

    try {
      const clientId = process.env.GMAIL_CLIENT_ID!;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET!;
      const redirectUri = process.env.GMAIL_REDIRECT_URI!;

      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        this.logger.error(`Gmail token exchange failed: ${await tokenRes.text()}`);
        return res.redirect(`${frontendUrl}/settings/email?connected=error`);
      }

      const tokens = await tokenRes.json();

      // Get user profile
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const profile = profileRes.ok ? await profileRes.json() : { emailAddress: '' };

      await this.emailAccountsService.saveGmailAccount(parsed.schemaName, parsed.userId, {
        email: profile.emailAddress,
        displayName: profile.emailAddress,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        historyId: profile.historyId,
        isShared: parsed.isShared,
      });

      // Register watch for push notifications
      try {
        const accounts = await this.emailAccountsService.getAccounts(parsed.schemaName, parsed.userId);
        const gmailAccount = accounts.find((a: any) => a.email === profile.emailAddress);
        if (gmailAccount) {
          await this.emailSyncService.registerGmailWatch(parsed.schemaName, gmailAccount.id);
        }
      } catch (err: any) {
        this.logger.warn(`Gmail watch registration failed: ${err.message}`);
      }

      return res.redirect(`${frontendUrl}/settings/email?connected=gmail`);
    } catch (err: any) {
      this.logger.error(`Gmail callback error: ${err.message}`);
      return res.redirect(`${frontendUrl}/settings/email?connected=error`);
    }
  }

  // ── Microsoft OAuth ───────────────────────────────────────

  @Get('connect/microsoft')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async connectMicrosoft(
    @Request() req: { user: JwtPayload },
    @Query('isShared') isShared: string,
  ) {
    const clientId = process.env.MS_CLIENT_ID;
    const redirectUri = process.env.MS_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Microsoft OAuth not configured');
    }

    const state = this.signOAuthState({
      userId: req.user.sub,
      schemaName: req.user.tenantSchema,
      isShared: isShared === 'true',
    });

    const scopes = 'Mail.ReadWrite Mail.Send offline_access User.Read';
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`;

    return { url };
  }

  @Get('callback/microsoft')
  async callbackMicrosoft(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl')
      || this.configService.get<string>('FRONTEND_URL')
      || 'http://localhost:5173';

    if (error || !code) {
      return res.redirect(`${frontendUrl}/settings/email?connected=error`);
    }

    const parsed = this.verifyOAuthState(state);
    if (!parsed) {
      return res.redirect(`${frontendUrl}/settings/email?connected=error`);
    }

    try {
      const clientId = process.env.MS_CLIENT_ID!;
      const clientSecret = process.env.MS_CLIENT_SECRET!;
      const redirectUri = process.env.MS_REDIRECT_URI!;

      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'Mail.ReadWrite Mail.Send offline_access User.Read',
        }),
      });

      if (!tokenRes.ok) {
        this.logger.error(`Microsoft token exchange failed: ${await tokenRes.text()}`);
        return res.redirect(`${frontendUrl}/settings/email?connected=error`);
      }

      const tokens = await tokenRes.json();

      // Get user info
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = meRes.ok ? await meRes.json() : { mail: '', displayName: '' };

      await this.emailAccountsService.saveMicrosoftAccount(parsed.schemaName, parsed.userId, {
        email: me.mail || me.userPrincipalName || '',
        displayName: me.displayName || '',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        isShared: parsed.isShared,
      });

      // Register webhook
      try {
        const accounts = await this.emailAccountsService.getAccounts(parsed.schemaName, parsed.userId);
        const msAccount = accounts.find((a: any) => a.email === (me.mail || me.userPrincipalName));
        if (msAccount) {
          await this.emailSyncService.registerMicrosoftWebhook(parsed.schemaName, msAccount.id);
        }
      } catch (err: any) {
        this.logger.warn(`Microsoft webhook registration failed: ${err.message}`);
      }

      return res.redirect(`${frontendUrl}/settings/email?connected=microsoft`);
    } catch (err: any) {
      this.logger.error(`Microsoft callback error: ${err.message}`);
      return res.redirect(`${frontendUrl}/settings/email?connected=error`);
    }
  }

  // ── IMAP manual config ────────────────────────────────────

  @Post('connect/imap')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async connectImap(@Request() req: { user: JwtPayload }, @Body() body: any) {
    // Test connection first
    let ImapFlow: any;
    try {
      ImapFlow = (await import('imapflow')).ImapFlow;
    } catch {
      throw new BadRequestException('IMAP support not available (imapflow not installed)');
    }

    const client = new ImapFlow({
      host: body.imapHost,
      port: body.imapPort,
      secure: body.imapSecure ?? true,
      auth: { user: body.email, pass: body.password },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
    } catch (err: any) {
      throw new BadRequestException(`IMAP connection failed: ${err.message}`);
    }

    const account = await this.emailAccountsService.createImapAccount(
      req.user.tenantSchema,
      req.user.sub,
      {
        email: body.email,
        displayName: body.displayName,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapSecure: body.imapSecure ?? true,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpSecure: body.smtpSecure ?? true,
        password: body.password,
        isShared: body.isShared ?? false,
      },
    );

    return { success: true, accountId: account.id };
  }

  @Post('test-imap')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async testImap(@Body() body: any) {
    let ImapFlow: any;
    try {
      ImapFlow = (await import('imapflow')).ImapFlow;
    } catch {
      throw new BadRequestException('IMAP support not available');
    }

    const client = new ImapFlow({
      host: body.imapHost,
      port: body.imapPort,
      secure: body.imapSecure ?? true,
      auth: { user: body.email, pass: body.password },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      return { success: true, message: 'Connection successful' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // ── Inbox Rules CRUD ─────────────────────────────────────

  @Get('rules')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'view')
  async getRules(@Request() req: { user: JwtPayload }) {
    return this.emailRulesService.getRules(req.user.tenantSchema);
  }

  @Post('rules')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async createRule(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.emailRulesService.createRule(req.user.tenantSchema, req.user.sub, body);
  }

  @Patch('rules/:ruleId')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async updateRule(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
    @Body() body: any,
  ) {
    return this.emailRulesService.updateRule(req.user.tenantSchema, req.user.sub, ruleId, body);
  }

  @Delete('rules/:ruleId')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'delete')
  async deleteRule(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
  ) {
    await this.emailRulesService.deleteRule(req.user.tenantSchema, req.user.sub, ruleId);
    return { success: true };
  }

  // ── Bulk operations ──────────────────────────────────────

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'delete')
  async bulkDelete(
    @Request() req: { user: JwtPayload },
    @Body() body: { ids: string[] },
  ) {
    if (!body.ids?.length) throw new BadRequestException('ids array is required');
    return this.emailStoreService.bulkDeleteEmails(req.user.tenantSchema, body.ids);
  }

  @Post('bulk/read')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async bulkMarkRead(
    @Request() req: { user: JwtPayload },
    @Body() body: { ids: string[]; isRead: boolean },
  ) {
    if (!body.ids?.length) throw new BadRequestException('ids array is required');
    await this.emailStoreService.bulkMarkRead(req.user.tenantSchema, body.ids, body.isRead);
    return { success: true };
  }

  // ── Email CRUD + Send ─────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'view')
  async getEmails(
    @Request() req: { user: JwtPayload },
    @Query('accountId') accountId?: string,
    @Query('direction') direction?: string,
    @Query('isRead') isRead?: string,
    @Query('isStarred') isStarred?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.emailStoreService.getEmails(req.user.tenantSchema, {
      accountId,
      userId: req.user.sub,
      direction,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      isStarred: isStarred !== undefined ? isStarred === 'true' : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('thread/:threadId')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'view')
  async getThreadEmails(
    @Request() req: { user: JwtPayload },
    @Param('threadId') threadId: string,
  ) {
    return this.emailStoreService.getThreadEmails(
      req.user.tenantSchema, threadId, req.user.sub,
    );
  }

  @Get('linked/:entityType/:entityId')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'view')
  async getEntityEmails(
    @Request() req: { user: JwtPayload },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.emailStoreService.getEntityEmails(
      req.user.tenantSchema, entityType, entityId, req.user.sub,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'view')
  async getEmailById(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.emailStoreService.getEmailById(req.user.tenantSchema, id, req.user.sub);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  @UseInterceptors(FilesInterceptor('attachments', 10))
  async sendEmail(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    // Parse JSON fields that may come as strings via FormData
    const dto = {
      ...body,
      to: typeof body.to === 'string' ? JSON.parse(body.to) : body.to,
      cc: body.cc ? (typeof body.cc === 'string' ? JSON.parse(body.cc) : body.cc) : undefined,
      bcc: body.bcc ? (typeof body.bcc === 'string' ? JSON.parse(body.bcc) : body.bcc) : undefined,
      attachments: files?.map((f) => ({
        filename: f.originalname,
        content: f.buffer,
        contentType: f.mimetype,
      })),
    };
    const emailId = await this.emailSendService.sendEmail(
      req.user.tenantSchema,
      dto.accountId,
      req.user.sub,
      dto,
    );
    return { id: emailId };
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async replyToEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const emailId = await this.emailSendService.replyToEmail(
      req.user.tenantSchema,
      body.accountId,
      req.user.sub,
      id,
      body,
    );
    return { id: emailId };
  }

  @Post(':id/forward')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'create')
  async forwardEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const emailId = await this.emailSendService.forwardEmail(
      req.user.tenantSchema,
      body.accountId,
      req.user.sub,
      id,
      body,
    );
    return { id: emailId };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'delete')
  async deleteEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    await this.emailStoreService.deleteEmail(req.user.tenantSchema, id);
    return { success: true };
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async markRead(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { isRead: boolean },
  ) {
    await this.emailStoreService.markRead(req.user.tenantSchema, id, body.isRead);
    return { success: true };
  }

  @Patch(':id/star')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async toggleStar(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    await this.emailStoreService.toggleStar(req.user.tenantSchema, id);
    return { success: true };
  }

  @Post(':id/link')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async linkEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { entityType: string; entityId: string },
  ) {
    await this.emailStoreService.linkEmail(
      req.user.tenantSchema, id, body.entityType, body.entityId, req.user.sub,
    );
    return { success: true };
  }

  @Delete(':id/link')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async unlinkEmail(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { entityType: string; entityId: string },
  ) {
    await this.emailStoreService.unlinkEmail(
      req.user.tenantSchema, id, body.entityType, body.entityId,
    );
    return { success: true };
  }

  // ── Sync trigger ──────────────────────────────────────────

  @Post('accounts/:id/sync')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('email', 'edit')
  async syncAccount(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    const account = await this.emailAccountsService.getAccountById(req.user.tenantSchema, id);
    if (account.provider === 'gmail') {
      await this.emailSyncService.syncGmailAccount(req.user.tenantSchema, id);
    } else if (account.provider === 'microsoft') {
      await this.emailSyncService.syncMicrosoftAccount(req.user.tenantSchema, id);
    } else if (account.provider === 'imap') {
      await this.emailSyncService.syncImapAccount(req.user.tenantSchema, id);
    }
    return { success: true };
  }

  // ── OAuth state helpers ───────────────────────────────────

  private signOAuthState(payload: { userId: string; schemaName: string; isShared: boolean }): string {
    const data = JSON.stringify(payload);
    const encoded = Buffer.from(data).toString('base64url');
    const secret = process.env.EMAIL_ENCRYPTION_KEY || 'default-secret';
    const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
  }

  private verifyOAuthState(state: string): { userId: string; schemaName: string; isShared: boolean } | null {
    try {
      const [encoded, sig] = state.split('.');
      const secret = process.env.EMAIL_ENCRYPTION_KEY || 'default-secret';
      const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
      if (sig !== expected) return null;
      return JSON.parse(Buffer.from(encoded, 'base64url').toString());
    } catch {
      return null;
    }
  }
}

// ── Public Controller (webhooks + tracking — NO auth) ─────────
@ApiTags('Email Webhooks')
@Controller('email')
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);

  constructor(
    private readonly emailStoreService: EmailStoreService,
    private readonly emailSyncService: EmailSyncService,
  ) {}

  @Post('webhook/gmail')
  async gmailWebhook(@Body() body: any) {
    try {
      const data = body.message?.data
        ? JSON.parse(Buffer.from(body.message.data, 'base64').toString())
        : null;

      if (!data?.emailAddress) return { ok: true };

      const match = await this.emailStoreService.findAccountByEmail(data.emailAddress);
      if (!match) return { ok: true };

      // Process async — never block webhook response
      this.emailSyncService
        .handleGmailPush(match.schemaName, match.accountId, data.historyId)
        .catch((err) => this.logger.error(`Gmail push handler error: ${err.message}`));
    } catch (err: any) {
      this.logger.error(`Gmail webhook error: ${err.message}`);
    }
    return { ok: true };
  }

  @Post('webhook/microsoft')
  async microsoftWebhook(@Body() body: any, @Query('validationToken') validationToken: string, @Res() res: Response) {
    // Microsoft webhook validation
    if (validationToken) {
      res.set('Content-Type', 'text/plain');
      res.send(validationToken);
      return;
    }

    const clientState = process.env.MS_WEBHOOK_CLIENT_STATE || 'intellicon-crm';

    try {
      for (const notification of body.value || []) {
        if (notification.clientState !== clientState) continue;

        const resourceData = notification.resourceData;
        if (!resourceData?.id) continue;

        // Find the account via subscription ID
        // For now process through all tenants
        const tenants = await this.emailStoreService['dataSource'].query(
          `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
        );

        for (const tenant of tenants) {
          try {
            const [account] = await this.emailStoreService['dataSource'].query(
              `SELECT id FROM "${tenant.schema_name}".email_accounts WHERE ms_subscription_id = $1 LIMIT 1`,
              [notification.subscriptionId],
            );
            if (account) {
              this.emailSyncService
                .handleMicrosoftNotification(tenant.schema_name, account.id, resourceData.id)
                .catch((err) => this.logger.error(`MS notification error: ${err.message}`));
              break;
            }
          } catch {
            // Schema may not have the table
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Microsoft webhook error: ${err.message}`);
    }

    res.status(200).send();
  }

  @Get('track/:token/open.gif')
  async trackOpen(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    // Try to find the email across tenants and track the open
    try {
      const tenants = await this.emailStoreService['dataSource'].query(
        `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
      );
      for (const tenant of tenants) {
        try {
          const tracked = await this.emailStoreService.trackOpen(
            tenant.schema_name, token,
            (res as any).req?.ip, (res as any).req?.headers?.['user-agent'],
          );
          if (tracked) break;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore — tracking should never fail visibly
    }

    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(TRACKING_PIXEL);
  }
}
