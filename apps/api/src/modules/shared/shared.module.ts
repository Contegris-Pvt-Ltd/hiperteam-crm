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

@Global()
@Module({
  controllers: [TablePreferencesController, ModuleSettingsController],
  providers: [AuditService, ActivityService, DocumentsService, NotesService, DataAccessService, TablePreferencesService, TableColumnsService, FieldValidationService],
  exports: [AuditService, ActivityService, DocumentsService, NotesService, DataAccessService, TablePreferencesService, TableColumnsService, FieldValidationService],
})
export class SharedModule {}