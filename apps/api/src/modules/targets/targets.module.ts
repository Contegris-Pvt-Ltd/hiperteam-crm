// ============================================================
// FILE: apps/api/src/modules/targets/targets.module.ts
// ============================================================

import { Module } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { TargetsRefreshCron } from './targets-refresh.cron';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [TargetsController, GamificationController],
  providers: [TargetsService, GamificationService, TargetsRefreshCron],
  exports: [TargetsService, GamificationService],
})
export class TargetsModule {}