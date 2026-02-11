import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ActivityService } from './activity.service';
import { DocumentsService } from './documents.service';
import { NotesService } from './notes.service';
import { DataAccessService } from './data-access.service';

@Global()
@Module({
  providers: [AuditService, ActivityService, DocumentsService, NotesService, DataAccessService],
  exports: [AuditService, ActivityService, DocumentsService, NotesService, DataAccessService],
})
export class SharedModule {}