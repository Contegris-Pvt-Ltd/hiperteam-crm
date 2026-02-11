import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TenantModule } from '../tenant/tenant.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TenantModule, SharedModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}