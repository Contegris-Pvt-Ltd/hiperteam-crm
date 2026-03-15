import { Module } from '@nestjs/common';
import { FormsController, FormsPublicController } from './forms.controller';
import { FormsService } from './forms.service';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [WorkflowsModule],
  controllers: [FormsController, FormsPublicController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
