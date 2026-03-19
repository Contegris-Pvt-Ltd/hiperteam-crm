import { Module } from '@nestjs/common';
import { Customer360Controller } from './customer-360.controller';
import { Customer360Service } from './customer-360.service';
import { ScoringService } from './scoring.service';
import { Customer360Cron } from './customer-360.cron';

@Module({
  controllers: [Customer360Controller],
  providers: [Customer360Service, ScoringService, Customer360Cron],
  exports: [Customer360Service, ScoringService],
})
export class Customer360Module {}
