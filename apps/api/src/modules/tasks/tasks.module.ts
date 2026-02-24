// ============================================================
// FILE: apps/api/src/modules/tasks/tasks.module.ts
// ============================================================

import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { SharedModule } from '../shared/shared.module';
import { NotificationModule } from '../notifications/notification.module';
import { CalendarSyncModule } from '../calendar-sync/calendar-sync.module';

@Module({
  imports: [SharedModule, NotificationModule, CalendarSyncModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}