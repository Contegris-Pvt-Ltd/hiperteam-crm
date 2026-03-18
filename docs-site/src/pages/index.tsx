import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/user-manual/getting-started"
            style={{marginRight: '1rem'}}>
            User Manual
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/admin-manual/getting-started"
            style={{marginRight: '1rem'}}>
            Admin Manual
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/technical-manual/architecture-overview">
            Technical Manual
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'User Manual',
    description: 'Complete guide for everyday CRM users — managing contacts, leads, opportunities, tasks, reports, and more.',
    link: '/user-manual/getting-started',
  },
  {
    title: 'Admin Manual',
    description: 'Configure roles, permissions, pipelines, custom fields, workflows, integrations, and system settings.',
    link: '/admin-manual/getting-started',
  },
  {
    title: 'Technical Manual',
    description: 'Architecture deep-dive, API reference, deployment guide, and development best practices.',
    link: '/technical-manual/architecture-overview',
  },
];

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Documentation"
      description="Intellicon CRM Documentation — User Manual, Admin Manual, and Technical Manual">
      <HomepageHeader />
      <main>
        <section style={{padding: '4rem 0'}}>
          <div className="container">
            <div className="row">
              {features.map((feature, idx) => (
                <div key={idx} className={clsx('col col--4')} style={{marginBottom: '2rem'}}>
                  <div className="card" style={{height: '100%', padding: '2rem'}}>
                    <Heading as="h3">{feature.title}</Heading>
                    <p>{feature.description}</p>
                    <Link className="button button--primary" to={feature.link}>
                      Read More
                    </Link>
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
