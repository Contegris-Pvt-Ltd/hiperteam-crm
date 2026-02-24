// ============================================================
// FILE: apps/api/src/modules/reports/report-schedule.cron.ts
//
// Cron job that runs every 15 minutes, checks for due report
// schedules, executes them, generates CSV/XLSX, and emails
// the results to recipients.
//
// Register in app.module.ts or reports.module.ts as a provider.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ReportsService } from './reports.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Injectable()
export class ReportScheduleCron {
  private readonly logger = new Logger(ReportScheduleCron.name);
  private isRunning = false;

  constructor(
    private dataSource: DataSource,
    private reportsService: ReportsService,
  ) {}

  /**
   * Runs every 15 minutes. Finds all active schedules whose
   * next_run_at is in the past, executes each report, and
   * sends the output to recipients.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleScheduledReports() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Get all tenant schemas
      const tenants = await this.dataSource.query(
        `SELECT schema_name, id FROM public.tenants WHERE is_active = true`,
      );

      for (const tenant of tenants) {
        await this.processTenantsSchedules(tenant.schema_name, tenant.id);
      }
    } catch (error: any) {
      this.logger.error(`Report schedule cron error: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async processTenantsSchedules(schema: string, tenantId: string) {
    try {
      // Check if report_schedules table exists
      const [tableCheck] = await this.dataSource.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = 'report_schedules'
        ) as exists`,
        [schema],
      );
      if (!tableCheck?.exists) return;

      // Find due schedules
      const dueSchedules = await this.dataSource.query(
        `SELECT rs.*, r.name as report_name, r.data_source, r.report_type, r.config, r.created_by
         FROM "${schema}".report_schedules rs
         JOIN "${schema}".reports r ON rs.report_id = r.id
         WHERE rs.is_active = true AND rs.next_run_at <= NOW()
         LIMIT 20`,
      );

      for (const schedule of dueSchedules) {
        try {
          await this.executeAndSend(schema, tenantId, schedule);
        } catch (err: any) {
          this.logger.error(
            `Failed to execute scheduled report "${schedule.report_name}" in ${schema}: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Error processing schedules for ${schema}: ${err.message}`);
    }
  }

  private async executeAndSend(schema: string, tenantId: string, schedule: any) {
    // Build a minimal JwtPayload for report execution
    // Use the report creator's permissions (or a system-level context)
    const systemUser: JwtPayload = {
      sub: schedule.created_by || 'system',
      email: 'system@internal',
      tenantId,
      tenantSlug: schema,
      tenantSchema: schema,
      role: 'admin',
      roleId: '',
      roleLevel: 100,
      permissions: { reports: { view: true, create: true, edit: true, delete: true, export: true, import: true } } as any,
      recordAccess: { reports: 'all' },
      fieldPermissions: {},
    };

    // Execute the report
    const result = await this.reportsService.execute(schema, schedule.report_id, systemUser);

    // Generate export
    const csv = this.reportsService['generateCSV'](result.data, result.columns, schedule.report_name);

    // Send email to recipients
    if (schedule.recipients && schedule.recipients.length > 0) {
      await this.sendReportEmail(schedule, csv);
    }

    // Update schedule: last_sent_at and calculate next_run_at
    const nextRun = this.calculateNextRun(schedule);
    await this.dataSource.query(
      `UPDATE "${schema}".report_schedules
       SET last_sent_at = NOW(), next_run_at = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextRun, schedule.id],
    );

    this.logger.log(`Executed scheduled report "${schedule.report_name}" → ${schedule.recipients?.length || 0} recipients`);
  }

  private async sendReportEmail(schedule: any, csv: { content: string; filename: string }) {
    // TODO: Integrate with EmailService when available
    // For now, log that the email would be sent
    this.logger.log(
      `[EMAIL] Would send report "${schedule.report_name}" (${csv.filename}) to: ${schedule.recipients?.join(', ')}`,
    );

    // When EmailService is available:
    // await this.emailService.sendWithAttachment({
    //   to: schedule.recipients,
    //   subject: `Scheduled Report: ${schedule.report_name}`,
    //   html: `<p>Your scheduled report "${schedule.report_name}" is attached.</p>`,
    //   attachments: [{ filename: csv.filename, content: csv.content, contentType: 'text/csv' }],
    // });
  }

  private calculateNextRun(schedule: any): Date {
    const now = new Date();
    const [hours, minutes] = (schedule.time_of_day || '08:00:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        const targetDay = schedule.day_of_week || 1;
        let daysUntil = (targetDay - next.getDay() + 7) % 7;
        if (daysUntil === 0) daysUntil = 7;
        next.setDate(next.getDate() + daysUntil);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(schedule.day_of_month || 1, 28));
        break;
    }

    return next;
  }
}