// ============================================================
// FILE: apps/api/src/modules/reports/reports.module.ts
// ============================================================

import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SharedModule } from '../shared/shared.module';
import { RecordScopeService } from '../../common/services/record-scope.service';

@Module({
  imports: [SharedModule],
  controllers: [ReportsController],
  providers: [ReportsService, RecordScopeService],
  exports: [ReportsService],
})
export class ReportsModule {}