import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [SharedModule, AdminModule, WorkflowsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}