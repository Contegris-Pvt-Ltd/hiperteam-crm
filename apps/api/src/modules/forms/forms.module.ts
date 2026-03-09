import { Module } from '@nestjs/common';
import { FormsController, FormsPublicController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  controllers: [FormsController, FormsPublicController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
