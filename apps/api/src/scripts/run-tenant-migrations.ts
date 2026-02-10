import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantSchemaService } from '../database/tenant-schema.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantSchemaService = app.get(TenantSchemaService);
  
  console.log('Running tenant schema migrations...');
  await tenantSchemaService.runAllPendingMigrations();
  console.log('Tenant migrations complete!');
  
  await app.close();
}

bootstrap().catch(console.error);