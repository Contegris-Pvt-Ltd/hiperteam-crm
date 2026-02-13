import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Tenant } from './database/entities/tenant.entity';
import { DatabaseModule } from './database/database.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { SharedModule } from './modules/shared/shared.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { TeamsModule } from './modules/teams/teams.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProductsModule } from './modules/products/products.module';
import { LeadsModule } from './modules/leads/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [Tenant],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    DatabaseModule,
    SharedModule,
    TenantModule,
    AuthModule,
    EmailModule,
    UsersModule,
    ContactsModule,
    AccountsModule,
    UploadModule,
    AdminModule,
    DepartmentsModule,
    TeamsModule,
    RolesModule,
    ProductsModule,
    LeadsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}