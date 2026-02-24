// ============================================================
// FILE: apps/api/src/modules/dashboard/dashboard.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TargetsModule } from '../targets/targets.module';

@Module({
  imports: [TargetsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}