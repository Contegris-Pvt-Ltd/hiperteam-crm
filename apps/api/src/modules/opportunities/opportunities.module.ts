// ============================================================
// FILE: apps/api/src/modules/opportunities/opportunities.module.ts
//
// Wire up the Opportunities module.
// Uses shared services (Audit, Activity, Notes, Documents)
// which are already available from SharedModule.
// ============================================================
import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitySettingsService } from './opportunity-settings.service';
import { OpportunitySettingsController } from './opportunity-settings.controller';
import { RecordTeamService } from '../shared/record-team.service';
import { ProposalsService } from './proposals.service';
import { ProposalsController, ProposalsPublicController } from './proposals.controller';
import { ContractsService } from './contracts.service';
import { ContractsController, ContractsPublicController } from './contracts.controller';
import { DocuSignService } from './docusign.service';
import { InvoicesService } from './invoices.service';
import { InvoicesController, InvoicesPublicController } from './invoices.controller';
import { XeroService } from './xero.service';
import { EmailModule } from '../email/email.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { NotificationModule } from '../notifications/notification.module';
import { Customer360Module } from '../customer-360/customer-360.module';

@Module({
  imports: [EmailModule, WorkflowsModule, NotificationModule, Customer360Module],
  controllers: [OpportunitiesController, OpportunitySettingsController, ProposalsController, ProposalsPublicController, ContractsController, ContractsPublicController, InvoicesController, InvoicesPublicController],
  providers: [OpportunitiesService, OpportunitySettingsService, RecordTeamService, ProposalsService, ContractsService, DocuSignService, InvoicesService, XeroService],
  exports: [OpportunitiesService, OpportunitySettingsService, ProposalsService, ContractsService, DocuSignService, InvoicesService, XeroService],
})
export class OpportunitiesModule {}