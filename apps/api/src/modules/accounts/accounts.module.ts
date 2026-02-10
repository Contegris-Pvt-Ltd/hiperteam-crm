import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [SharedModule, AdminModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}