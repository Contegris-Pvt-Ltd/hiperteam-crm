import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { SharedModule } from '../shared/shared.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [SharedModule, AdminModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}