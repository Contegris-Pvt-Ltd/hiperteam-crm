import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { pageLayoutApi } from '../../api/page-layout.api';
import type { PageLayoutConfig, WidgetConfig } from '../../api/page-layout.api';
import { CustomFieldRenderer } from '../shared/CustomFieldRenderer';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';

// ==================== SYSTEM FIELD DEFINITIONS ====================

interface SystemFieldDef {
  key: string;
  label: string;
  section: 'basic' | 'contact' | 'address' | 'social' | 'other';
  type?: 'text' | 'email' | 'phone' | 'url';
  icon?: React.ReactNode;
}

const CONTACT_SYSTEM_FIELDS: SystemFieldDef[] = [
  // Basic
  { key: 'firstName', label: 'First Name', section: 'basic' },
  { key: 'lastName', label: 'Last Name', section: 'basic' },
  { key: 'jobTitle', label: 'Job Title', section: 'basic' },
  { key: 'department', label: 'Department', section: 'basic' },
  { key: 'company', label: 'Company', section: 'basic' },
  // Contact
  { key: 'email', label: 'Email', section: 'contact', type: 'email', icon: <Mail className="w-4 h-4" /> },
  { key: 'phone', label: 'Phone', section: 'contact', type: 'phone', icon: <Phone className="w-4 h-4" /> },
  { key: 'mobile', label: 'Mobile', section: 'contact', type: 'phone', icon: <Phone className="w-4 h-4" /> },
  { key: 'website', label: 'Website', section: 'contact', type: 'url', icon: <Globe className="w-4 h-4" /> },
  // Address
  { key: 'addressLine1', label: 'Address Line 1', section: 'address' },
  { key: 'addressLine2', label: 'Address Line 2', section: 'address' },
  { key: 'city', label: 'City', section: 'address' },
  { key: 'state', label: 'State/Province', section: 'address' },
  { key: 'postalCode', label: 'Postal Code', section: 'address' },
  { key: 'country', label: 'Country', section: 'address' },
  // Social
  { key: 'socialProfiles.linkedin', label: 'LinkedIn', section: 'social', type: 'url' },
  { key: 'socialProfiles.twitter', label: 'Twitter', section: 'social', type: 'url' },
  { key: 'socialProfiles.facebook', label: 'Facebook', section: 'social', type: 'url' },
  // Other
  { key: 'source', label: 'Lead Source', section: 'other' },
  { key: 'notes', label: 'Notes', section: 'other' },
];

// Helper to get nested value
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// ==================== TYPES ====================

interface DynamicPageRendererProps {
  module: string;
  layoutType: 'detail' | 'edit' | 'create';
  recordId?: string;
  data: Record<string, unknown>;
  customFields: CustomField[];
  tabs: CustomTab[];
  groups: CustomFieldGroup[];
  onFieldChange?: (fieldKey: string, value: unknown) => void;
  isEditing?: boolean;
  // Widget content providers
  relatedRecordsRenderer?: (module: string, maxItems?: number) => React.ReactNode;
  activityTimelineRenderer?: (maxItems?: number) => React.ReactNode;
  filesRenderer?: (showAddButton?: boolean) => React.ReactNode;
  notesRenderer?: (showAddButton?: boolean) => React.ReactNode;
  tasksRenderer?: (maxItems?: number, showAddButton?: boolean) => React.ReactNode;
  profileCompletionRenderer?: () => React.ReactNode;
}

// ==================== SYSTEM FIELD VALUE RENDERER ====================

function SystemFieldValue({ field, value }: { field: SystemFieldDef; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 dark:text-slate-500">-</span>;
  }

  const strValue = String(value);

  switch (field.type) {
    case 'email':
      return (
        <a href={`mailto:${strValue}`} className="text-blue-600 hover:underline">
          {strValue}
        </a>
      );
    case 'phone':
      return (
        <a href={`tel:${strValue}`} className="text-blue-600 hover:underline">
          {strValue}
        </a>
      );
    case 'url':
      return (
        <a href={strValue} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
          {strValue}
        </a>
      );
    default:
      return <span>{strValue}</span>;
  }
}

// ==================== FIELDS SECTION WIDGET ====================

function FieldsSectionWidget({
  section,
  title,
  collapsed: initialCollapsed,
  data,
  customFields,
  groups,
  onFieldChange,
  module,
}: {
  section: string;
  title?: string;
  collapsed?: boolean;
  data: Record<string, unknown>;
  customFields: CustomField[];
  groups: CustomFieldGroup[];
  onFieldChange: (fieldKey: string, value: unknown) => void;
  module: string;
}) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed || false);

  // Get SYSTEM fields for this section
  const systemFieldDefs = module === 'contacts' ? CONTACT_SYSTEM_FIELDS : [];
  const sectionSystemFields = systemFieldDefs.filter(f => f.section === section);
  
  // Get CUSTOM fields for this section
  const sectionCustomFields = customFields.filter(f => f.section === section && !f.tabId);
  const sectionGroups = groups.filter(g => g.section === section && !g.tabId);

  // Check if we have any fields with values
  const hasSystemFieldValues = sectionSystemFields.some(f => {
    const val = getNestedValue(data, f.key);
    return val !== undefined && val !== null && val !== '';
  });
  
  const hasCustomFieldValues = sectionCustomFields.some(f => {
    const val = data.customFields ? (data.customFields as Record<string, unknown>)[f.fieldKey] : data[f.fieldKey];
    return val !== undefined && val !== null && val !== '';
  });

  // If no fields at all, don't render
  if (sectionSystemFields.length === 0 && sectionCustomFields.length === 0 && sectionGroups.length === 0) {
    return null;
  }

  // If no values, show empty state or hide
  if (!hasSystemFieldValues && !hasCustomFieldValues) {
    return null;
  }

  const displayTitle = title || section.charAt(0).toUpperCase() + section.slice(1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
      >
        <h3 className="font-semibold text-gray-900 dark:text-white">{displayTitle}</h3>
        {isCollapsed ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {!isCollapsed && (
        <div className="p-4 space-y-3">
          {/* Render SYSTEM fields */}
          {sectionSystemFields.map(field => {
            const value = getNestedValue(data, field.key);
            if (value === undefined || value === null || value === '') return null;
            
            return (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2">
                  {field.icon}
                  {field.label}
                </span>
                <span className="text-sm text-gray-900 dark:text-white text-right">
                  <SystemFieldValue field={field} value={value} />
                </span>
              </div>
            );
          })}

          {/* Render CUSTOM field groups */}
          {sectionGroups.map(group => {
            const groupFields = customFields.filter(f => f.groupId === group.id);
            if (groupFields.length === 0) return null;

            const customFieldValues = data.customFields as Record<string, unknown> || {};
            const hasGroupValues = groupFields.some(f => {
              const val = customFieldValues[f.fieldKey];
              return val !== undefined && val !== null && val !== '';
            });
            
            if (!hasGroupValues) return null;

            return (
              <div key={group.id} className="pt-3 border-t border-gray-100 dark:border-slate-800">
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{group.name}</h4>
                <div className={`grid gap-3 ${group.columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {groupFields.map(field => {
                    const value = customFieldValues[field.fieldKey];
                    if (value === undefined || value === null || value === '') return null;
                    
                    return (
                      <div key={field.id} className={`flex items-center justify-between gap-4 ${field.columnSpan === 2 ? 'col-span-2' : ''}`}>
                        <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                        <span className="text-sm text-gray-900 dark:text-white text-right">
                          <CustomFieldRenderer
                            field={field}
                            value={value}
                            onChange={onFieldChange}
                            allFields={customFields}
                            allValues={customFieldValues}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Render ungrouped CUSTOM fields */}
          {(() => {
            const ungroupedFields = sectionCustomFields.filter(f => !f.groupId);
            const customFieldValues = data.customFields as Record<string, unknown> || {};
            
            const fieldsWithValues = ungroupedFields.filter(f => {
              const val = customFieldValues[f.fieldKey];
              return val !== undefined && val !== null && val !== '';
            });
            
            if (fieldsWithValues.length === 0) return null;

            return (
              <div className={sectionSystemFields.length > 0 || sectionGroups.length > 0 ? 'pt-3 border-t border-gray-100 dark:border-slate-800' : ''}>
                {fieldsWithValues.map(field => (
                  <div key={field.id} className="flex items-center justify-between gap-4 mb-2 last:mb-0">
                    <span className="text-sm text-gray-500 dark:text-slate-400">{field.fieldLabel}</span>
                    <span className="text-sm text-gray-900 dark:text-white text-right">
                      <CustomFieldRenderer
                        field={field}
                        value={customFieldValues[field.fieldKey]}
                        onChange={onFieldChange}
                        allFields={customFields}
                        allValues={customFieldValues}
                      />
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ==================== CUSTOM TAB WIDGET ====================

function CustomTabWidget({
  tabId,
  tab,
  title,
  collapsed: initialCollapsed,
  data,
  customFields,
  groups,
  onFieldChange,
}: {
  tabId: string;
  tab?: CustomTab;
  title?: string;
  collapsed?: boolean;
  data: Record<string, unknown>;
  customFields: CustomField[];
  groups: CustomFieldGroup[];
  onFieldChange: (fieldKey: string, value: unknown) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed || false);

  const tabFields = customFields.filter(f => f.tabId === tabId);
  const tabGroups = groups.filter(g => g.tabId === tabId);
  const customFieldValues = data.customFields as Record<string, unknown> || {};

  if (tabFields.length === 0 && tabGroups.length === 0) {
    return null;
  }

  const displayTitle = title || tab?.name || 'Custom Tab';

  return (
    <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
      >
        <h3 className="font-semibold text-purple-900 dark:text-purple-300">{displayTitle}</h3>
        {isCollapsed ? <ChevronRight className="w-5 h-5 text-purple-400" /> : <ChevronDown className="w-5 h-5 text-purple-400" />}
      </button>

      {!isCollapsed && (
        <div className="p-4">
          {/* Render groups */}
          {tabGroups.map(group => {
            const groupFields = customFields.filter(f => f.groupId === group.id);
            if (groupFields.length === 0) return null;

            return (
              <div key={group.id} className="mb-4 last:mb-0">
                <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">{group.name}</h4>
                <div className={`grid gap-4 ${group.columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {groupFields.map(field => (
                    <div key={field.id} className={field.columnSpan === 2 ? 'col-span-2' : ''}>
                      <CustomFieldRenderer
                        field={field}
                        value={customFieldValues[field.fieldKey]}
                        onChange={onFieldChange}
                        allFields={customFields}
                        allValues={customFieldValues}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Ungrouped fields */}
          {(() => {
            const ungroupedFields = tabFields.filter(f => !f.groupId);
            if (ungroupedFields.length === 0) return null;

            return (
              <div className={tabGroups.length > 0 ? 'mt-4 pt-4 border-t border-purple-200 dark:border-purple-700' : ''}>
                <div className="grid grid-cols-2 gap-4">
                  {ungroupedFields.map(field => (
                    <div key={field.id} className={field.columnSpan === 2 ? 'col-span-2' : ''}>
                      <CustomFieldRenderer
                        field={field}
                        value={customFieldValues[field.fieldKey]}
                        onChange={onFieldChange}
                        allFields={customFields}
                        allValues={customFieldValues}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ==================== PLACEHOLDER WIDGET ====================

function PlaceholderWidget({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4">
        {children || (
          <p className="text-sm text-gray-500 dark:text-slate-400">{description || 'Widget content'}</p>
        )}
      </div>
    </div>
  );
}

// ==================== WIDGET ROUTER ====================

function WidgetRouter({
  widget,
  data,
  customFields,
  tabs,
  groups,
  onFieldChange,
  module,
  relatedRecordsRenderer,
  activityTimelineRenderer,
  filesRenderer,
  notesRenderer,
  tasksRenderer,
  profileCompletionRenderer,
}: {
  widget: WidgetConfig;
  data: Record<string, unknown>;
  customFields: CustomField[];
  tabs: CustomTab[];
  groups: CustomFieldGroup[];
  onFieldChange: (fieldKey: string, value: unknown) => void;
  module: string;
  relatedRecordsRenderer?: (module: string, maxItems?: number) => React.ReactNode;
  activityTimelineRenderer?: (maxItems?: number) => React.ReactNode;
  filesRenderer?: (showAddButton?: boolean) => React.ReactNode;
  notesRenderer?: (showAddButton?: boolean) => React.ReactNode;
  tasksRenderer?: (maxItems?: number, showAddButton?: boolean) => React.ReactNode;
  profileCompletionRenderer?: () => React.ReactNode;
}) {
  switch (widget.type) {
    case 'fields-section':
      return (
        <FieldsSectionWidget
          section={widget.section || 'basic'}
          title={widget.title}
          collapsed={widget.collapsed}
          data={data}
          customFields={customFields}
          groups={groups}
          onFieldChange={onFieldChange}
          module={module}
        />
      );

    case 'custom-tab':
      const tab = tabs.find(t => t.id === widget.tabId);
      return (
        <CustomTabWidget
          tabId={widget.tabId || ''}
          tab={tab}
          title={widget.title}
          collapsed={widget.collapsed}
          data={data}
          customFields={customFields}
          groups={groups}
          onFieldChange={onFieldChange}
        />
      );

    case 'field-group':
      const group = groups.find(g => g.id === widget.groupId);
      if (!group) return null;
      const groupFields = customFields.filter(f => f.groupId === widget.groupId);
      if (groupFields.length === 0) return null;
      
      const customFieldValues = data.customFields as Record<string, unknown> || {};
      
      return (
        <PlaceholderWidget title={widget.title || group.name}>
          <div className={`grid gap-4 ${group.columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {groupFields.map(field => (
              <div key={field.id} className={field.columnSpan === 2 ? 'col-span-2' : ''}>
                <CustomFieldRenderer
                  field={field}
                  value={customFieldValues[field.fieldKey]}
                  onChange={onFieldChange}
                  allFields={customFields}
                  allValues={customFieldValues}
                />
              </div>
            ))}
          </div>
        </PlaceholderWidget>
      );

    case 'profile-completion':
      return profileCompletionRenderer ? (
        <PlaceholderWidget title={widget.title || 'Profile Completion'}>
          {profileCompletionRenderer()}
        </PlaceholderWidget>
      ) : (
        <PlaceholderWidget title={widget.title || 'Profile Completion'} description="Profile completion widget" />
      );

    case 'related-records':
      return relatedRecordsRenderer && widget.relatedModule ? (
        <PlaceholderWidget title={widget.title || `Related ${widget.relatedModule}`}>
          {relatedRecordsRenderer(widget.relatedModule, widget.maxItems)}
        </PlaceholderWidget>
      ) : (
        <PlaceholderWidget title={widget.title || 'Related Records'} description="Related records will appear here" />
      );

    case 'activity-timeline':
      return activityTimelineRenderer ? (
        <PlaceholderWidget title={widget.title || 'Activity Timeline'}>
          {activityTimelineRenderer(widget.maxItems)}
        </PlaceholderWidget>
      ) : (
        <PlaceholderWidget title={widget.title || 'Activity Timeline'} description="Activity timeline will appear here" />
      );

    case 'files-attachments':
      return filesRenderer ? (
        <PlaceholderWidget title={widget.title || 'Files'}>
          {filesRenderer(widget.showAddButton)}
        </PlaceholderWidget>
      ) : (
        <PlaceholderWidget title={widget.title || 'Files'} description="Files will appear here" />
      );

    case 'notes':
      return notesRenderer ? (
        <PlaceholderWidget title={widget.title || 'Notes'}>
          {notesRenderer(widget.showAddButton)}
        </PlaceholderWidget>
      ) : (
        <PlaceholderWidget title={widget.title || 'Notes'} description="Notes will appear here" />
      );

    case 'tasks':
      return tasksRenderer ? (
        <PlaceholderWidget title={widget.title || 'Tasks'}>
          {tasksRenderer(widget.maxItems, widget.showAddButton)}
        </PlaceholderWidget>
      ) : (
        <PlaceholderWidget title={widget.title || 'Tasks'} description="Tasks will appear here" />
      );

    case 'custom-html':
      return (
        <PlaceholderWidget title={widget.title || 'Custom Content'}>
          {widget.customContent ? (
            <div dangerouslySetInnerHTML={{ __html: widget.customContent }} />
          ) : (
            <p className="text-sm text-gray-500">No content configured</p>
          )}
        </PlaceholderWidget>
      );

    case 'spacer':
      return <div style={{ height: widget.height || 24 }} />;

    case 'divider':
      return <hr className="border-gray-200 dark:border-slate-700" />;

    default:
      return null;
  }
}

// ==================== MAIN RENDERER ====================

export function DynamicPageRenderer({
  module,
  layoutType,
  data,
  customFields,
  tabs,
  groups,
  onFieldChange,
  relatedRecordsRenderer,
  activityTimelineRenderer,
  filesRenderer,
  notesRenderer,
  tasksRenderer,
  profileCompletionRenderer,
}: DynamicPageRendererProps) {
  const [layoutConfig, setLayoutConfig] = useState<PageLayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLayout();
  }, [module, layoutType]);

  const loadLayout = async () => {
    setLoading(true);
    try {
      const config = await pageLayoutApi.getActiveLayout(module, layoutType);
      setLayoutConfig(config);
    } catch (err) {
      console.error('Failed to load layout:', err);
      // Use default layout
      setLayoutConfig({
        template: 'sidebar-right',
        regions: {
          main: {
            id: 'main',
            widgets: [
              { id: '1', type: 'fields-section', section: 'basic' },
              { id: '2', type: 'fields-section', section: 'contact' },
              { id: '3', type: 'fields-section', section: 'address' },
            ],
          },
          sidebar: {
            id: 'sidebar',
            widgets: [
              { id: '4', type: 'profile-completion' },
              { id: '5', type: 'activity-timeline' },
            ],
          },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !layoutConfig) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Default no-op handler if none provided
  const handleFieldChange = onFieldChange || ((_key: string, _value: unknown) => {});

  // Get template layout classes
  const getLayoutClasses = (): { container: string; regions: Record<string, string> } => {
    switch (layoutConfig.template) {
      case 'single-column':
        return { container: 'flex flex-col', regions: { main: 'w-full' } };
      case 'two-column-equal':
        return { container: 'grid grid-cols-1 lg:grid-cols-2 gap-6', regions: { left: '', right: '' } };
      case 'two-column-wide-left':
        return { container: 'grid grid-cols-1 lg:grid-cols-3 gap-6', regions: { main: 'lg:col-span-2', sidebar: '' } };
      case 'two-column-wide-right':
        return { container: 'grid grid-cols-1 lg:grid-cols-3 gap-6', regions: { sidebar: '', main: 'lg:col-span-2' } };
      case 'three-column':
        return { container: 'grid grid-cols-1 lg:grid-cols-3 gap-6', regions: { left: '', center: '', right: '' } };
      case 'sidebar-left':
        return { container: 'grid grid-cols-1 lg:grid-cols-3 gap-6', regions: { sidebar: '', main: 'lg:col-span-2' } };
      case 'sidebar-right':
        return { container: 'grid grid-cols-1 lg:grid-cols-3 gap-6', regions: { main: 'lg:col-span-2', sidebar: '' } };
      default:
        return { container: 'flex flex-col', regions: { main: 'w-full' } };
    }
  };

  const layoutClasses = getLayoutClasses();
  const regionOrder = Object.keys(layoutConfig.regions);

  return (
    <div className={layoutClasses.container}>
      {regionOrder.map(regionId => {
        const region = layoutConfig.regions[regionId];
        if (!region) return null;

        return (
          <div key={regionId} className={layoutClasses.regions[regionId] || ''}>
            <div className="space-y-4">
              {region.widgets.map(widget => (
                <WidgetRouter
                  key={widget.id}
                  widget={widget}
                  data={data}
                  customFields={customFields}
                  tabs={tabs}
                  groups={groups}
                  onFieldChange={handleFieldChange}
                  module={module}
                  relatedRecordsRenderer={relatedRecordsRenderer}
                  activityTimelineRenderer={activityTimelineRenderer}
                  filesRenderer={filesRenderer}
                  notesRenderer={notesRenderer}
                  tasksRenderer={tasksRenderer}
                  profileCompletionRenderer={profileCompletionRenderer}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== HOOK FOR EASY USAGE ====================

export function usePageLayout(module: string, layoutType: 'detail' | 'edit' | 'create') {
  const [layoutConfig, setLayoutConfig] = useState<PageLayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLayout();
  }, [module, layoutType]);

  const loadLayout = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await pageLayoutApi.getActiveLayout(module, layoutType);
      setLayoutConfig(config);
    } catch (err) {
      setError('Failed to load layout');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return { layoutConfig, loading, error, reload: loadLayout };
}