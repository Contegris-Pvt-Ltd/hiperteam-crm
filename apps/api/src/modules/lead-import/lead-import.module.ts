import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { LeadImportController } from './lead-import.controller';
import { LeadImportService } from './lead-import.service';
import { LeadImportProcessor } from './lead-import.processor';
import { NotificationModule } from '../notifications/notification.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('redis.host', 'localhost'),
          port: configService.get('redis.port', 6379),
          password: configService.get('redis.password', '') || undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'lead-import',
    }),
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
    NotificationModule,
    LeadsModule,
  ],
  controllers: [LeadImportController],
  providers: [LeadImportService, LeadImportProcessor],
  exports: [LeadImportService],
})
export class LeadImportModule {}
