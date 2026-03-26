import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

const manuals = [
  {
    title: 'User Manual',
    icon: '📘',
    iconClass: 'manual-card-icon-user',
    description: 'Everything you need to manage contacts, leads, opportunities, tasks, reports, and your day-to-day CRM workflow.',
    link: '/user-manual/getting-started',
    topics: ['Contacts', 'Leads', 'Opportunities', 'Tasks', 'Reports', 'Invoices', 'Projects', 'Email', 'Forms'],
  },
  {
    title: 'Admin Manual',
    icon: '⚙️',
    iconClass: 'manual-card-icon-admin',
    description: 'Configure roles, permissions, pipelines, custom fields, workflows, integrations, and every system setting.',
    link: '/admin-manual/getting-started',
    topics: ['RBAC', 'Pipelines', 'Custom Fields', 'Workflows', 'Approvals', 'Integrations', 'Templates'],
  },
  {
    title: 'Technical Manual',
    icon: '🛠️',
    iconClass: 'manual-card-icon-tech',
    description: 'Architecture deep-dive, API reference for every endpoint, deployment guide, and development best practices.',
    link: '/technical-manual/architecture-overview',
    topics: ['Architecture', 'API Reference', 'Multi-Tenant', 'RBAC', 'Deployment', 'Migrations'],
  },
];

const features = [
  { icon: '👥', title: 'Contact Management', desc: 'Full lifecycle from lead to customer' },
  { icon: '📊', title: 'Pipeline & Stages', desc: 'Visual Kanban boards with drag-and-drop' },
  { icon: '🔐', title: '3-Level RBAC', desc: 'Module, record, and field-level permissions' },
  { icon: '📧', title: 'Email Integration', desc: 'Gmail, Microsoft 365, and IMAP/SMTP' },
  { icon: '📝', title: 'Form Builder', desc: 'Drag-and-drop forms with CRM actions' },
  { icon: '📅', title: 'Scheduling', desc: 'Booking pages with Google Calendar sync' },
  { icon: '⚡', title: 'Workflow Automation', desc: '13 action types with conditional logic' },
  { icon: '📈', title: 'Reports & Dashboards', desc: 'Visual report builder with 11 chart types' },
  { icon: '🏢', title: 'Multi-Tenant', desc: 'Schema-per-tenant PostgreSQL isolation' },
  { icon: '💰', title: 'Invoicing', desc: 'Line items, payments, recurrence, Xero sync' },
  { icon: '📋', title: 'Project Management', desc: 'Phases, Gantt, Kanban, time tracking' },
  { icon: '✅', title: 'Approval Engine', desc: 'Multi-step chains with escalation' },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="Documentation"
      description="IntelliSales CRM Documentation — User Manual, Admin Manual, and Technical Manual">

      {/* Hero */}
      <header className="hero-banner">
        <div className="container">
          <img src="/img/logo-transparent.png" alt="IntelliSales CRM" className="hero-logo" />
          <div className="hero-version">Documentation Portal</div>
          <h1 className="hero-title">IntelliSales CRM</h1>
          <p className="hero-subtitle">
            Complete Business &amp; People Operating System — from Lead to Customer Success
          </p>
          <div className="hero-buttons">
            <Link className="hero-btn hero-btn-primary" to="/user-manual/getting-started">
              Get Started
            </Link>
            <Link className="hero-btn hero-btn-secondary" to="/admin-manual/getting-started">
              Admin Guide
            </Link>
            <Link className="hero-btn hero-btn-secondary" to="/technical-manual/architecture-overview">
              API &amp; Architecture
            </Link>
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-number">120+</span>
              <span className="stat-label">Doc Pages</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">15+</span>
              <span className="stat-label">Modules</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100+</span>
              <span className="stat-label">API Endpoints</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">11</span>
              <span className="stat-label">Chart Types</span>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Manual Cards */}
        <section className="manuals-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Choose Your Manual</h2>
              <p className="section-subtitle">Three comprehensive guides for every role in your organization</p>
            </div>
            <div className="row">
              {manuals.map((manual, idx) => (
                <div key={idx} className="col col--4" style={{marginBottom: '1.5rem'}}>
                  <div className="manual-card">
                    <div className={`manual-card-icon ${manual.iconClass}`}>
                      {manual.icon}
                    </div>
                    <h3>{manual.title}</h3>
                    <p>{manual.description}</p>
                    <div className="manual-card-topics">
                      {manual.topics.map((topic) => (
                        <span key={topic} className="manual-card-topic">{topic}</span>
                      ))}
                    </div>
                    <Link className="manual-card-link" to={manual.link}>
                      Read the {manual.title} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="features-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">What's Covered</h2>
              <p className="section-subtitle">Every feature documented with step-by-step guides and API references</p>
            </div>
            <div className="feature-grid">
              {features.map((f, idx) => (
                <div key={idx} className="feature-item">
                  <div className="feature-icon">{f.icon}</div>
                  <div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
