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
import { SharedModule } from '../shared/shared.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { AdminService } from './admin.service';

@Module({
  imports: [SharedModule, OpportunitiesModule],
  controllers: [
    AdminController,
    PageLayoutController,
    ModuleLayoutSettingsController,
  ],
  providers: [
    AdminService,
    CustomFieldsService,
    ProfileCompletionService,
    CustomTabsService,
    CustomFieldGroupsService,
    PageLayoutService,
    ModuleLayoutSettingsService,
  ],
  exports: [
    AdminService,
    CustomFieldsService,
    ProfileCompletionService,
    CustomTabsService,
    CustomFieldGroupsService,
    PageLayoutService,
    ModuleLayoutSettingsService,
  ],
})
export class AdminModule {}