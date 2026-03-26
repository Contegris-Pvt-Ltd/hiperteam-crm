import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'IntelliSales CRM',
  tagline: 'Complete Business & People Operating System',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs-hiperteam.intellicon.io',
  baseUrl: '/',

  organizationName: 'hiperteam',
  projectName: 'hiperteam-crm',

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: '/',
        searchResultLimits: 10,
        searchResultContextMaxLength: 50,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'IntelliSales CRM',
      logo: {
        alt: 'IntelliSales CRM Logo',
        src: 'img/logo.png',
        srcDark: 'img/logo-transparent.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'userManual',
          position: 'left',
          label: 'User Manual',
        },
        {
          type: 'docSidebar',
          sidebarId: 'adminManual',
          position: 'left',
          label: 'Admin Manual',
        },
        {
          type: 'docSidebar',
          sidebarId: 'technicalManual',
          position: 'left',
          label: 'Technical Manual',
        },
      ],
    },
    footer: {
      style: 'dark',
      logo: {
        alt: 'IntelliSales CRM',
        src: 'img/logo-transparent.png',
        width: 60,
        height: 60,
      },
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'User Manual', to: '/user-manual/getting-started' },
            { label: 'Admin Manual', to: '/admin-manual/getting-started' },
            { label: 'Technical Manual', to: '/technical-manual/architecture-overview' },
          ],
        },
        {
          title: 'Quick Links',
          items: [
            { label: 'API Reference', to: '/technical-manual/api-reference/authentication' },
            { label: 'RBAC Guide', to: '/admin-manual/roles-permissions' },
            { label: 'Troubleshooting', to: '/technical-manual/troubleshooting' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} IntelliSales CRM. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'sql', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
