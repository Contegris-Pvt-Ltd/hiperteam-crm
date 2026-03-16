// ============================================================
// FILE: apps/api/src/modules/leads/leads.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadSettingsController } from './lead-settings.controller';
import { LeadsService } from './leads.service';
import { LeadSettingsService } from './lead-settings.service';
import { LeadScoringService } from './lead-scoring.service';
import { RecordTeamService } from '../shared/record-team.service';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { DocumentsService } from '../shared/documents.service';
import { NotesService } from '../shared/notes.service';
import { SlaService } from './sla.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [WorkflowsModule, NotificationModule],
  controllers: [LeadsController, LeadSettingsController],
  providers: [
    LeadsService,
    LeadSettingsService,
    LeadScoringService,
    RecordTeamService,
    AuditService,
    ActivityService,
    DocumentsService,
    NotesService,
    SlaService,
  ],
  exports: [LeadsService, LeadSettingsService, LeadScoringService, RecordTeamService, SlaService],
})
export class LeadsModule {}
