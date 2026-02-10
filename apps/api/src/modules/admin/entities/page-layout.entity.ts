import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// Widget types available in the page designer
export type WidgetType =
  | 'fields-section'      // Standard fields section (basic, contact, address, etc.)
  | 'custom-tab'          // Custom tab with custom fields
  | 'field-group'         // A specific field group
  | 'profile-completion'  // Profile completion widget
  | 'related-records'     // Related accounts, contacts, etc.
  | 'activity-timeline'   // Activity/history timeline
  | 'files-attachments'   // Files and attachments widget
  | 'notes'               // Notes widget
  | 'tasks'               // Tasks widget
  | 'custom-html'         // Custom HTML/embed widget
  | 'spacer'              // Empty spacer
  | 'divider';            // Horizontal divider

// Layout templates
export type LayoutTemplate =
  | 'single-column'       // Full width single column
  | 'two-column-equal'    // 50-50 split
  | 'two-column-wide-left'  // 66-33 split
  | 'two-column-wide-right' // 33-66 split
  | 'three-column'        // 33-33-33 split
  | 'sidebar-left'        // 25-75 with left sidebar
  | 'sidebar-right';      // 75-25 with right sidebar

// Widget configuration
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  collapsed?: boolean;
  
  // Type-specific config
  section?: string;           // For fields-section
  tabId?: string;             // For custom-tab
  groupId?: string;           // For field-group
  relatedModule?: string;     // For related-records
  maxItems?: number;          // For related-records, activity-timeline
  showAddButton?: boolean;    // For related-records, notes, tasks
  customContent?: string;     // For custom-html
  height?: number;            // For spacer
}

// Region configuration
export interface RegionConfig {
  id: string;
  widgets: WidgetConfig[];
}

// Full page layout configuration
export interface PageLayoutConfig {
  template: LayoutTemplate;
  regions: Record<string, RegionConfig>;
  settings?: {
    showHeader?: boolean;
    headerStyle?: 'default' | 'compact' | 'hero';
    showBreadcrumb?: boolean;
    stickyHeader?: boolean;
  };
}

@Entity('page_layouts')
@Index(['tenantId', 'module', 'layoutType'])
export class PageLayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ length: 50 })
  module: string; // contacts, accounts, leads, opportunities

  @Column({ length: 20 })
  layoutType: 'detail' | 'edit' | 'create'; // Which view this layout applies to

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb' })
  config: PageLayoutConfig;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Default layout configurations
export const DEFAULT_LAYOUTS: Record<string, PageLayoutConfig> = {
  'detail-sidebar-right': {
    template: 'sidebar-right',
    regions: {
      main: {
        id: 'main',
        widgets: [
          { id: 'w1', type: 'fields-section', section: 'basic', title: 'Basic Information' },
          { id: 'w2', type: 'fields-section', section: 'contact', title: 'Contact Details' },
          { id: 'w3', type: 'fields-section', section: 'address', title: 'Address' },
          { id: 'w4', type: 'fields-section', section: 'social', title: 'Social Profiles' },
          { id: 'w5', type: 'fields-section', section: 'other', title: 'Other Information' },
        ],
      },
      sidebar: {
        id: 'sidebar',
        widgets: [
          { id: 'w6', type: 'profile-completion', title: 'Profile Completion' },
          { id: 'w7', type: 'related-records', relatedModule: 'accounts', title: 'Related Accounts', maxItems: 5 },
          { id: 'w8', type: 'activity-timeline', title: 'Recent Activity', maxItems: 10 },
          { id: 'w9', type: 'files-attachments', title: 'Files', showAddButton: true },
        ],
      },
    },
    settings: {
      showHeader: true,
      headerStyle: 'default',
      showBreadcrumb: true,
    },
  },
  'detail-single-column': {
    template: 'single-column',
    regions: {
      main: {
        id: 'main',
        widgets: [
          { id: 'w1', type: 'fields-section', section: 'basic', title: 'Basic Information' },
          { id: 'w2', type: 'fields-section', section: 'contact', title: 'Contact Details' },
          { id: 'w3', type: 'fields-section', section: 'address', title: 'Address' },
          { id: 'w4', type: 'related-records', relatedModule: 'accounts', title: 'Related Accounts' },
          { id: 'w5', type: 'activity-timeline', title: 'Activity' },
        ],
      },
    },
  },
  'edit-two-column': {
    template: 'two-column-equal',
    regions: {
      left: {
        id: 'left',
        widgets: [
          { id: 'w1', type: 'fields-section', section: 'basic', title: 'Basic Information' },
          { id: 'w2', type: 'fields-section', section: 'address', title: 'Address' },
        ],
      },
      right: {
        id: 'right',
        widgets: [
          { id: 'w3', type: 'fields-section', section: 'contact', title: 'Contact Details' },
          { id: 'w4', type: 'fields-section', section: 'social', title: 'Social Profiles' },
        ],
      },
    },
  },
};