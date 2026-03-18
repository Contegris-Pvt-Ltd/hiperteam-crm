import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  userManual: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'user-manual/getting-started',
        'user-manual/logging-in',
        'user-manual/navigating-the-interface',
        'user-manual/your-profile',
      ],
    },
    {
      type: 'category',
      label: 'Dashboard',
      items: [
        'user-manual/dashboard-overview',
        'user-manual/dashboard-widgets',
        'user-manual/dashboard-customization',
      ],
    },
    {
      type: 'category',
      label: 'Contacts',
      items: [
        'user-manual/contacts-overview',
        'user-manual/contacts-managing',
        'user-manual/contacts-detail-page',
      ],
    },
    {
      type: 'category',
      label: 'Accounts',
      items: [
        'user-manual/accounts-overview',
        'user-manual/accounts-managing',
        'user-manual/accounts-detail-page',
      ],
    },
    {
      type: 'category',
      label: 'Leads',
      items: [
        'user-manual/leads-overview',
        'user-manual/leads-list-and-kanban',
        'user-manual/leads-detail-page',
        'user-manual/leads-pipeline-stages',
        'user-manual/leads-scoring-sla',
        'user-manual/leads-converting',
        'user-manual/leads-importing',
      ],
    },
    {
      type: 'category',
      label: 'Opportunities',
      items: [
        'user-manual/opportunities-overview',
        'user-manual/opportunities-list-and-kanban',
        'user-manual/opportunities-detail-page',
        'user-manual/opportunities-closing',
        'user-manual/opportunities-forecasting',
      ],
    },
    {
      type: 'category',
      label: 'Products',
      items: [
        'user-manual/products-overview',
        'user-manual/products-price-books',
      ],
    },
    {
      type: 'category',
      label: 'Tasks',
      items: [
        'user-manual/tasks-overview',
        'user-manual/tasks-views',
        'user-manual/tasks-managing',
        'user-manual/tasks-calendar-sync',
      ],
    },
    {
      type: 'category',
      label: 'Projects',
      items: [
        'user-manual/projects-overview',
        'user-manual/projects-managing',
      ],
    },
    {
      type: 'category',
      label: 'Invoices',
      items: [
        'user-manual/invoices-overview',
        'user-manual/invoices-managing',
      ],
    },
    {
      type: 'category',
      label: 'Email',
      items: [
        'user-manual/email-inbox',
        'user-manual/email-composing',
        'user-manual/email-rules',
      ],
    },
    {
      type: 'category',
      label: 'Reports',
      items: [
        'user-manual/reports-overview',
        'user-manual/reports-builder',
        'user-manual/reports-viewer',
      ],
    },
    {
      type: 'category',
      label: 'Workflows & Approvals',
      items: [
        'user-manual/workflows-overview',
        'user-manual/approvals-overview',
      ],
    },
    {
      type: 'category',
      label: 'Engagement',
      items: [
        'user-manual/forms-overview',
        'user-manual/scheduling-overview',
      ],
    },
    {
      type: 'category',
      label: 'Notifications',
      items: [
        'user-manual/notifications-overview',
      ],
    },
    {
      type: 'category',
      label: 'Common Features',
      items: [
        'user-manual/global-search',
        'user-manual/notes-documents',
        'user-manual/activity-timeline',
        'user-manual/data-tables',
        'user-manual/bulk-operations',
      ],
    },
  ],

  adminManual: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'admin-manual/getting-started',
        'admin-manual/admin-panel-overview',
      ],
    },
    {
      type: 'category',
      label: 'User Management',
      items: [
        'admin-manual/users-management',
        'admin-manual/inviting-users',
        'admin-manual/org-chart',
      ],
    },
    {
      type: 'category',
      label: 'Organization Structure',
      items: [
        'admin-manual/departments',
        'admin-manual/teams',
      ],
    },
    {
      type: 'category',
      label: 'Roles & Permissions',
      items: [
        'admin-manual/roles-permissions',
        'admin-manual/record-access',
        'admin-manual/field-permissions',
      ],
    },
    {
      type: 'category',
      label: 'Customization',
      items: [
        'admin-manual/custom-fields',
        'admin-manual/field-validation',
        'admin-manual/page-designer',
        'admin-manual/custom-tabs-groups',
      ],
    },
    {
      type: 'category',
      label: 'Pipeline Configuration',
      items: [
        'admin-manual/pipelines-stages',
        'admin-manual/stage-ownership',
        'admin-manual/priorities',
      ],
    },
    {
      type: 'category',
      label: 'Module Settings',
      items: [
        'admin-manual/lead-settings',
        'admin-manual/opportunity-settings',
        'admin-manual/task-settings',
        'admin-manual/project-settings',
      ],
    },
    {
      type: 'category',
      label: 'Targets & Gamification',
      items: [
        'admin-manual/targets-setup',
        'admin-manual/gamification-badges',
      ],
    },
    {
      type: 'category',
      label: 'Notifications & Templates',
      items: [
        'admin-manual/notification-settings',
        'admin-manual/notification-templates',
      ],
    },
    {
      type: 'category',
      label: 'Workflows & Approvals',
      items: [
        'admin-manual/workflow-builder',
        'admin-manual/approval-rules',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'admin-manual/integrations-overview',
        'admin-manual/xero-integration',
        'admin-manual/google-calendar',
        'admin-manual/email-integration',
      ],
    },
    {
      type: 'category',
      label: 'Data Management',
      items: [
        'admin-manual/import-export',
        'admin-manual/batch-jobs',
        'admin-manual/audit-logs',
      ],
    },
    {
      type: 'category',
      label: 'System Settings',
      items: [
        'admin-manual/general-settings',
        'admin-manual/api-keys',
      ],
    },
  ],

  technicalManual: [
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'technical-manual/architecture-overview',
        'technical-manual/multi-tenant-architecture',
        'technical-manual/project-structure',
      ],
    },
    {
      type: 'category',
      label: 'Setup & Development',
      items: [
        'technical-manual/local-setup',
        'technical-manual/environment-variables',
        'technical-manual/database-migrations',
      ],
    },
    {
      type: 'category',
      label: 'Authentication & Authorization',
      items: [
        'technical-manual/authentication-jwt',
        'technical-manual/rbac-deep-dive',
        'technical-manual/guards-decorators',
      ],
    },
    {
      type: 'category',
      label: 'Backend Patterns',
      items: [
        'technical-manual/module-pattern',
        'technical-manual/shared-services',
        'technical-manual/pipeline-system',
        'technical-manual/queue-system',
      ],
    },
    {
      type: 'category',
      label: 'Frontend Architecture',
      items: [
        'technical-manual/frontend-overview',
        'technical-manual/routing-state',
        'technical-manual/api-layer',
        'technical-manual/component-patterns',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'technical-manual/api-reference/authentication',
        'technical-manual/api-reference/users',
        'technical-manual/api-reference/contacts',
        'technical-manual/api-reference/accounts',
        'technical-manual/api-reference/leads',
        'technical-manual/api-reference/opportunities',
        'technical-manual/api-reference/tasks',
        'technical-manual/api-reference/products',
        'technical-manual/api-reference/dashboard',
        'technical-manual/api-reference/reports',
        'technical-manual/api-reference/notifications',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'technical-manual/deployment',
        'technical-manual/troubleshooting',
        'technical-manual/error-codes',
        'technical-manual/best-practices',
      ],
    },
  ],
};

export default sidebars;
