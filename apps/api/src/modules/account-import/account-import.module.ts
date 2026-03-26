import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AccountImportController } from './account-import.controller';
import { AccountImportService } from './account-import.service';
import { AccountImportProcessor } from './account-import.processor';
import { NotificationModule } from '../notifications/notification.module';

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
      name: 'account-import',
    }),
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
    NotificationModule,
  ],
  controllers: [AccountImportController],
  providers: [AccountImportService, AccountImportProcessor],
  exports: [AccountImportService],
})
export class AccountImportModule {}
