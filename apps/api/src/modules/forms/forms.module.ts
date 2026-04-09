import { Module } from '@nestjs/common';
import { FormsController, FormsPublicController } from './forms.controller';
import { FormsService } from './forms.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [WorkflowsModule, LeadsModule],
  controllers: [FormsController, FormsPublicController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
