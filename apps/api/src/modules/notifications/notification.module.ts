import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { EmailChannel } from './channels/email.channel';
import { BrowserPushChannel } from './channels/browser-push.channel';
import { SmsWhatsAppChannel } from './channels/sms-whatsapp.channel';
import { ChatChannel } from './channels/chat.channel';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationPreferencesService,
    NotificationTemplateService,
    NotificationGateway,
    EmailChannel,
    BrowserPushChannel,
    SmsWhatsAppChannel,
    ChatChannel,
  ],
  exports: [
    NotificationService,
    NotificationGateway,
    EmailChannel,
    BrowserPushChannel,
    SmsWhatsAppChannel,
    ChatChannel,
  ],
})
export class NotificationModule {}