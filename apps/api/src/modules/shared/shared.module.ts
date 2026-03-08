import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ActivityService } from './activity.service';
import { DocumentsService } from './documents.service';
import { NotesService } from './notes.service';
import { DataAccessService } from './data-access.service';
import { TablePreferencesService } from './table-preferences.service';
import { TableColumnsService } from './table-columns.service';
import { TablePreferencesController } from './table-preferences.controller';
import { FieldValidationService } from './field-validation.service';
import { ModuleSettingsController } from './module-settings.controller';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { EmailModule } from '../email/email.module';

@Global()
@Module({
  imports: [EmailModule],
  controllers: [TablePreferencesController, ModuleSettingsController, ApprovalController],
  providers: [AuditService, ActivityService, DocumentsService, NotesService, DataAccessService, TablePreferencesService, TableColumnsService, FieldValidationService, ApprovalService],
  exports: [AuditService, ActivityService, DocumentsService, NotesService, DataAccessService, TablePreferencesService, TableColumnsService, FieldValidationService, ApprovalService],
})
export class SharedModule {}