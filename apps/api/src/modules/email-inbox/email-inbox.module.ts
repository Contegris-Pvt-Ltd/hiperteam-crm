import { Module } from '@nestjs/common';
import { EmailInboxController, EmailWebhookController } from './email-inbox.controller';
import { EmailAccountsService } from './email-accounts.service';
import { EmailSyncService } from './email-sync.service';
import { EmailStoreService } from './email-store.service';
import { EmailSendService } from './email-send.service';
import { EmailRulesService } from './email-rules.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [EmailInboxController, EmailWebhookController],
  providers: [
    EmailAccountsService,
    EmailSyncService,
    EmailStoreService,
    EmailSendService,
    EmailRulesService,
  ],
  exports: [EmailStoreService, EmailRulesService],
})
export class EmailInboxModule {}
