import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { RoutingAlgorithmsService } from './routing-algorithms.service';
import { NotificationModule } from '../notifications/notification.module';
import { EmailMarketingModule } from '../email-marketing/email-marketing.module';

@Module({
  imports: [NotificationModule, EmailMarketingModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    WorkflowRunnerService,
    RoutingAlgorithmsService,
  ],
  exports: [
    WorkflowRunnerService,  // ← exported so all entity modules can inject it
  ],
})
export class WorkflowsModule {}
