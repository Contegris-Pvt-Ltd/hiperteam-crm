import { Module, Global } from '@nestjs/common';
import { TenantSchemaService } from './tenant-schema.service';
import { MigrationRunnerService } from './migration-runner.service';

@Global()
@Module({
  providers: [TenantSchemaService, MigrationRunnerService],
  exports: [TenantSchemaService, MigrationRunnerService],
})
export class DatabaseModule {}