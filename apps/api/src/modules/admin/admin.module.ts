import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CustomFieldsService } from './custom-fields.service';
import { ProfileCompletionService } from './profile-completion.service';
import { CustomTabsService } from './custom-tabs.service';
import { CustomFieldGroupsService } from './custom-field-groups.service';
import { PageLayoutService } from './page-layout.service';
import { PageLayoutController } from './page-layout.controller';
import { ModuleLayoutSettingsService } from './module-layout-settings.service';
import { ModuleLayoutSettingsController } from './module-layout-settings.controller';

@Module({
  imports: [],  // No TypeOrmModule.forFeature - we use raw SQL
  controllers: [
    AdminController,
    PageLayoutController,
    ModuleLayoutSettingsController,
  ],
  providers: [
    CustomFieldsService,
    ProfileCompletionService,
    CustomTabsService,
    CustomFieldGroupsService,
    PageLayoutService,
    ModuleLayoutSettingsService,
  ],
  exports: [
    CustomFieldsService,
    ProfileCompletionService,
    CustomTabsService,
    CustomFieldGroupsService,
    PageLayoutService,
    ModuleLayoutSettingsService,
  ],
})
export class AdminModule {}