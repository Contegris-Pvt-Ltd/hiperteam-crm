import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ActivityService } from './activity.service';
import { DocumentsService } from './documents.service';
import { NotesService } from './notes.service';

@Global()
@Module({
  providers: [AuditService, ActivityService, DocumentsService, NotesService],
  exports: [AuditService, ActivityService, DocumentsService, NotesService],
})
export class SharedModule {}