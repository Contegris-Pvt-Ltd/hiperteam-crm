import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { ProjectsController, ClientPortalController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [SharedModule, WorkflowsModule],
  controllers: [ProjectsController, ClientPortalController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
