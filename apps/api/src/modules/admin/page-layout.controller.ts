/**
 * PAGE LAYOUT CONTROLLER
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PageLayoutService, CreatePageLayoutDto, UpdatePageLayoutDto } from './page-layout.service';

// Static widget metadata
const AVAILABLE_WIDGETS = [
  { type: 'fields-section', label: 'Fields Section', description: 'Display fields from a specific section', icon: 'LayoutList', category: 'fields', configurable: ['section', 'title', 'collapsed'] },
  { type: 'custom-tab', label: 'Custom Tab', description: 'Display fields from a custom tab', icon: 'FolderOpen', category: 'fields', configurable: ['tabId', 'title', 'collapsed'] },
  { type: 'field-group', label: 'Field Group', description: 'Display a specific field group', icon: 'Group', category: 'fields', configurable: ['groupId', 'title', 'collapsed'] },
  { type: 'profile-completion', label: 'Profile Completion', description: 'Show profile completion progress', icon: 'PieChart', category: 'widgets', configurable: ['title'] },
  { type: 'related-records', label: 'Related Records', description: 'Show related records from another module', icon: 'Link', category: 'widgets', configurable: ['relatedModule', 'maxItems', 'showAddButton', 'title'] },
  { type: 'activity-timeline', label: 'Activity Timeline', description: 'Show recent activities', icon: 'Activity', category: 'widgets', configurable: ['maxItems', 'title'] },
  { type: 'files-attachments', label: 'Files & Attachments', description: 'Show uploaded files', icon: 'Paperclip', category: 'widgets', configurable: ['showAddButton', 'title'] },
  { type: 'notes', label: 'Notes', description: 'Show notes section', icon: 'StickyNote', category: 'widgets', configurable: ['showAddButton', 'title'] },
  { type: 'tasks', label: 'Tasks', description: 'Show related tasks', icon: 'CheckSquare', category: 'widgets', configurable: ['showAddButton', 'title'] },
  { type: 'custom-html', label: 'Custom HTML', description: 'Add custom HTML or embed', icon: 'Code', category: 'advanced', configurable: ['customContent', 'title'] },
  { type: 'spacer', label: 'Spacer', description: 'Add vertical space', icon: 'Space', category: 'layout', configurable: ['height'] },
  { type: 'divider', label: 'Divider', description: 'Add horizontal line', icon: 'Minus', category: 'layout', configurable: [] },
];

// Static template metadata
const AVAILABLE_TEMPLATES = [
  { id: 'single-column', name: 'Single Column', description: 'Full width single column layout', regions: ['main'], preview: '████████' },
  { id: 'two-column-equal', name: 'Two Column (Equal)', description: '50/50 split layout', regions: ['left', 'right'], preview: '████ ████' },
  { id: 'two-column-wide-left', name: 'Two Column (Wide Left)', description: '66/33 split layout', regions: ['main', 'sidebar'], preview: '██████ ██' },
  { id: 'two-column-wide-right', name: 'Two Column (Wide Right)', description: '33/66 split layout', regions: ['sidebar', 'main'], preview: '██ ██████' },
  { id: 'three-column', name: 'Three Column', description: 'Three equal columns', regions: ['left', 'center', 'right'], preview: '██ ██ ██' },
  { id: 'sidebar-left', name: 'Sidebar Left', description: 'Narrow left sidebar with main content', regions: ['sidebar', 'main'], preview: '█ ███████' },
  { id: 'sidebar-right', name: 'Sidebar Right', description: 'Main content with narrow right sidebar', regions: ['main', 'sidebar'], preview: '███████ █' },
];

@Controller('admin/page-layouts')
@UseGuards(JwtAuthGuard)
export class PageLayoutController {
  constructor(private readonly layoutService: PageLayoutService) {}

  /**
   * Get available widgets (static)
   * IMPORTANT: This must come BEFORE @Get(':id')
   */
  @Get('widgets')
  async getAvailableWidgets() {
    return { data: AVAILABLE_WIDGETS };
  }

  /**
   * Get available templates (static)
   * IMPORTANT: This must come BEFORE @Get(':id')
   */
  @Get('templates')
  async getAvailableTemplates() {
    return { data: AVAILABLE_TEMPLATES };
  }

  /**
   * Get the active/default layout for a module and type
   * IMPORTANT: This must come BEFORE @Get(':id')
   */
  @Get('active/:module/:layoutType')
  async getActiveLayout(
    @Request() req: any,
    @Param('module') module: string,
    @Param('layoutType') layoutType: string,
  ) {
    const layout = await this.layoutService.getActiveLayout(
      req.user.tenantSchema,
      module,
      layoutType,
    );
    return { data: layout };
  }

  /**
   * Get all layouts for a module
   */
  @Get()
  async getLayouts(
    @Request() req: any,
    @Query('module') module: string,
    @Query('layoutType') layoutType?: string,
  ) {
    const layouts = await this.layoutService.getLayouts(
      req.user.tenantSchema,
      module,
      layoutType,
    );
    return { data: layouts };
  }

  /**
   * Get a single layout by ID
   * IMPORTANT: This must come AFTER static routes like /widgets, /templates
   */
  @Get(':id')
  async getLayout(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const layout = await this.layoutService.getLayout(req.user.tenantSchema, id);
    return { data: layout };
  }

  /**
   * Create a new layout
   */
  @Post()
  async createLayout(
    @Request() req: any,
    @Body() dto: CreatePageLayoutDto,
  ) {
    const layout = await this.layoutService.createLayout(
      req.user.tenantSchema,
      dto,
      req.user.userId,
    );
    return { data: layout };
  }

  /**
   * Update a layout
   */
  @Put(':id')
  async updateLayout(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePageLayoutDto,
  ) {
    const layout = await this.layoutService.updateLayout(
      req.user.tenantSchema,
      id,
      dto,
      req.user.userId,
    );
    return { data: layout };
  }

  /**
   * Delete a layout
   */
  @Delete(':id')
  async deleteLayout(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    await this.layoutService.deleteLayout(req.user.tenantSchema, id);
    return { success: true };
  }

  /**
   * Set a layout as default
   */
  @Put(':id/set-default')
  async setAsDefault(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const layout = await this.layoutService.setAsDefault(req.user.tenantSchema, id);
    return { data: layout };
  }

  /**
   * Duplicate a layout
   */
  @Post(':id/duplicate')
  async duplicateLayout(
    @Request() req: any,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    const layout = await this.layoutService.duplicateLayout(
      req.user.tenantSchema,
      id,
      name,
      req.user.userId,
    );
    return { data: layout };
  }
}