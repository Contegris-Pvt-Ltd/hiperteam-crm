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

@Module({
  controllers: [OpportunitiesController, OpportunitySettingsController],
  providers: [OpportunitiesService, OpportunitySettingsService, RecordTeamService],
  exports: [OpportunitiesService, OpportunitySettingsService],
})
export class OpportunitiesModule {}