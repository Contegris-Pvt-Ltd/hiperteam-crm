import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { EmailMarketingService } from './email-marketing.service';
import { DataSource } from 'typeorm';

@ApiTags('Email Marketing')
@Controller()
export class EmailMarketingController {
  private readonly logger = new Logger(EmailMarketingController.name);

  constructor(
    private readonly emailMarketingService: EmailMarketingService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== AUTHENTICATED ENDPOINTS ====================

  @Get('email-marketing/lists')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'view')
  async getLists(@Request() req: { user: any }) {
    return this.emailMarketingService.getLists(req.user.tenantId);
  }

  @Post('email-marketing/lists/refresh')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'edit')
  async refreshLists(@Request() req: { user: any }) {
    return this.emailMarketingService.refreshListCache(req.user.tenantId);
  }

  @Post('email-marketing/test-connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('settings', 'edit')
  async testConnection(@Request() req: { user: any }) {
    return this.emailMarketingService.testConnection(req.user.tenantId);
  }

  @Post('email-marketing/contacts/:contactId/subscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'edit')
  async subscribeContact(
    @Request() req: { user: any },
    @Param('contactId') contactId: string,
    @Body() body: { listId: string; listName: string; tags?: string[] },
  ) {
    // Fetch contact email
    const [contact] = await this.dataSource.query(
      `SELECT email, first_name, last_name
       FROM "${req.user.tenantSchema}".contacts
       WHERE id = $1 AND deleted_at IS NULL`,
      [contactId],
    );

    if (!contact || !contact.email) {
      throw new BadRequestException('Contact not found or has no email');
    }

    return this.emailMarketingService.addContactToList(
      req.user.tenantId,
      req.user.tenantSchema,
      body.listId,
      body.listName,
      { email: contact.email, firstName: contact.first_name, lastName: contact.last_name },
      contactId,
    );
  }

  @Delete('email-marketing/contacts/:contactId/lists/:listId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'edit')
  async unsubscribeContact(
    @Request() req: { user: any },
    @Param('contactId') contactId: string,
    @Param('listId') listId: string,
  ) {
    const [contact] = await this.dataSource.query(
      `SELECT email FROM "${req.user.tenantSchema}".contacts
       WHERE id = $1 AND deleted_at IS NULL`,
      [contactId],
    );

    if (!contact || !contact.email) {
      throw new BadRequestException('Contact not found or has no email');
    }

    return this.emailMarketingService.removeContactFromList(
      req.user.tenantId,
      req.user.tenantSchema,
      listId,
      contact.email,
      contactId,
    );
  }

  @Get('email-marketing/contacts/:contactId/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'view')
  async getContactStats(
    @Request() req: { user: any },
    @Param('contactId') contactId: string,
  ) {
    return this.emailMarketingService.getContactStats(req.user.tenantSchema, contactId);
  }

  @Get('email-marketing/accounts/:accountId/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('accounts', 'view')
  async getAccountStats(
    @Request() req: { user: any },
    @Param('accountId') accountId: string,
  ) {
    return this.emailMarketingService.getAccountContactsStats(req.user.tenantSchema, accountId);
  }

  // ==================== WEBHOOK ENDPOINTS (NO AUTH) ====================

  @Post('webhooks/mailerlite')
  async handleMailerliteWebhook(
    @Query('tenant') tenantId: string,
    @Body() body: any,
  ) {
    if (!tenantId) {
      this.logger.warn('MailerLite webhook: missing tenant query param');
      return { received: true };
    }

    const schemaName = await this.resolveTenantSchema(tenantId);
    if (!schemaName) {
      this.logger.warn(`MailerLite webhook: unknown tenant ${tenantId}`);
      return { received: true };
    }

    try {
      // MailerLite webhook payload varies by event type
      const events = Array.isArray(body.events) ? body.events : [body];
      for (const evt of events) {
        const type = this.mapMailerliteEventType(evt.type || evt.event || '');
        const email =
          evt.data?.subscriber?.email ||
          evt.data?.email ||
          evt.subscriber?.email ||
          evt.email ||
          '';
        const listId = evt.data?.group_id
          ? String(evt.data.group_id)
          : undefined;

        if (type && email) {
          await this.emailMarketingService.processWebhookEvent(schemaName, 'mailerlite', {
            type,
            email,
            listId,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`MailerLite webhook error: ${err.message}`);
    }

    return { received: true };
  }

  @Post('webhooks/mailchimp')
  async handleMailchimpWebhook(
    @Query('tenant') tenantId: string,
    @Body() body: any,
  ) {
    if (!tenantId) {
      this.logger.warn('Mailchimp webhook: missing tenant query param');
      return { received: true };
    }

    const schemaName = await this.resolveTenantSchema(tenantId);
    if (!schemaName) {
      this.logger.warn(`Mailchimp webhook: unknown tenant ${tenantId}`);
      return { received: true };
    }

    try {
      const type = this.mapMailchimpEventType(body.type || '');
      const email = body.data?.email || body.data?.merges?.EMAIL || '';
      const listId = body.data?.list_id || '';

      if (type && email) {
        await this.emailMarketingService.processWebhookEvent(schemaName, 'mailchimp', {
          type,
          email,
          listId: listId || undefined,
        });
      }
    } catch (err: any) {
      this.logger.error(`Mailchimp webhook error: ${err.message}`);
    }

    return { received: true };
  }

  // ==================== PRIVATE HELPERS ====================

  private async resolveTenantSchema(tenantId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT schema_name FROM public.tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );

    if (!rows.length) {
      // Try master.tenants as fallback
      const masterRows = await this.dataSource.query(
        `SELECT schema_name FROM master.tenants WHERE id = $1 LIMIT 1`,
        [tenantId],
      ).catch(() => []);

      return masterRows.length ? masterRows[0].schema_name : null;
    }

    return rows[0].schema_name;
  }

  private mapMailerliteEventType(eventType: string): string | null {
    const map: Record<string, string> = {
      'subscriber.added_to_group': 'subscribe',
      'subscriber.removed_from_group': 'unsubscribe',
      'subscriber.bounced': 'bounce',
      'subscriber.spam_reported': 'spam',
      'subscriber.campaign_opened': 'open',
      'subscriber.campaign_link_clicked': 'click',
      'subscriber.create': 'subscribe',
      'subscriber.unsubscribe': 'unsubscribe',
      'campaign.subscriber.open': 'open',
      'campaign.subscriber.click': 'click',
    };
    return map[eventType] || null;
  }

  private mapMailchimpEventType(eventType: string): string | null {
    const map: Record<string, string> = {
      subscribe: 'subscribe',
      unsubscribe: 'unsubscribe',
      cleaned: 'bounce',
      campaign: 'open',
      click: 'click',
    };
    return map[eventType] || null;
  }
}
