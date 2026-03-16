// ============================================================
// FILE: apps/api/src/modules/scheduling/scheduling.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import {
  SchedulingController,
  SchedulingPublicController,
} from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { EmailModule } from '../email/email.module';
import { CalendarSyncModule } from '../calendar-sync/calendar-sync.module';

@Module({
  imports: [EmailModule, CalendarSyncModule],
  controllers: [SchedulingController, SchedulingPublicController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
