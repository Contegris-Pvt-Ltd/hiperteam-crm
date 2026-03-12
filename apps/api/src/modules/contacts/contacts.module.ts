import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [SharedModule, AdminModule, WorkflowsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}