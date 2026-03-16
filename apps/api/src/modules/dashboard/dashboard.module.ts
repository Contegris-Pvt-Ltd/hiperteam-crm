// ============================================================
// FILE: apps/api/src/modules/dashboard/dashboard.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardLayoutController, SharedDashboardController } from './dashboard-layout.controller';
import { DashboardLayoutService } from './dashboard-layout.service';
import { TargetsModule } from '../targets/targets.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [TargetsModule, ReportsModule],
  controllers: [DashboardController, DashboardLayoutController, SharedDashboardController],
  providers: [DashboardService, DashboardLayoutService],
  exports: [DashboardService, DashboardLayoutService],
})
export class DashboardModule {}