// ============================================================
// FILE: apps/api/src/modules/calendar-sync/calendar-sync.module.ts
// ============================================================

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncCron } from './calendar-sync.cron';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule, ScheduleModule.forRoot()],
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService, CalendarSyncCron],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}