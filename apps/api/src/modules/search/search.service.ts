import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface SearchResult {
  id: string;
  type: 'contact' | 'account' | 'lead' | 'opportunity' | 'project' | 'task';
  title: string;
  subtitle: string | null;
  url: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly dataSource: DataSource) {}

  async globalSearch(schemaName: string, query: string, limit = 20): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) return [];

    const term = `%${query.trim()}%`;
    const perType = Math.ceil(limit / 6);

    const [contacts, accounts, leads, opportunities, projects, tasks] = await Promise.all([
      this.dataSource.query(
        `SELECT id, first_name, last_name, email, company
         FROM "${schemaName}".contacts
         WHERE deleted_at IS NULL
           AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR company ILIKE $1
                OR (first_name || ' ' || last_name) ILIKE $1)
         ORDER BY updated_at DESC NULLS LAST
         LIMIT $2`,
        [term, perType],
      ),
      this.dataSource.query(
        `SELECT id, name, industry
         FROM "${schemaName}".accounts
         WHERE deleted_at IS NULL
           AND (name ILIKE $1 OR industry ILIKE $1)
         ORDER BY updated_at DESC NULLS LAST
         LIMIT $2`,
        [term, perType],
      ),
      this.dataSource.query(
        `SELECT id, first_name, last_name, email, company
         FROM "${schemaName}".leads
         WHERE deleted_at IS NULL
           AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR company ILIKE $1
                OR (first_name || ' ' || last_name) ILIKE $1)
         ORDER BY updated_at DESC NULLS LAST
         LIMIT $2`,
        [term, perType],
      ),
      this.dataSource.query(
        `SELECT id, name, amount, currency
         FROM "${schemaName}".opportunities
         WHERE deleted_at IS NULL
           AND name ILIKE $1
         ORDER BY updated_at DESC NULLS LAST
         LIMIT $2`,
        [term, perType],
      ),
      this.dataSource.query(
        `SELECT p.id, p.name, ps.name AS status_name
         FROM "${schemaName}".projects p
         LEFT JOIN "${schemaName}".project_statuses ps ON ps.id = p.status_id
         WHERE p.deleted_at IS NULL
           AND p.name ILIKE $1
         ORDER BY p.updated_at DESC NULLS LAST
         LIMIT $2`,
        [term, perType],
      ),
      this.dataSource.query(
        `SELECT id, title, status_id
         FROM "${schemaName}".tasks
         WHERE deleted_at IS NULL
           AND title ILIKE $1
         ORDER BY updated_at DESC NULLS LAST
         LIMIT $2`,
        [term, perType],
      ),
    ]);

    const results: SearchResult[] = [];

    for (const c of contacts) {
      results.push({
        id: c.id,
        type: 'contact',
        title: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        subtitle: c.email || c.company || null,
        url: `/contacts/${c.id}`,
      });
    }

    for (const a of accounts) {
      results.push({
        id: a.id,
        type: 'account',
        title: a.name,
        subtitle: a.industry || null,
        url: `/accounts/${a.id}`,
      });
    }

    for (const l of leads) {
      results.push({
        id: l.id,
        type: 'lead',
        title: `${l.first_name || ''} ${l.last_name || ''}`.trim(),
        subtitle: l.email || l.company || null,
        url: `/leads/${l.id}`,
      });
    }

    for (const o of opportunities) {
      results.push({
        id: o.id,
        type: 'opportunity',
        title: o.name,
        subtitle: o.amount ? `${o.currency || '$'}${Number(o.amount).toLocaleString()}` : null,
        url: `/opportunities/${o.id}`,
      });
    }

    for (const p of projects) {
      results.push({
        id: p.id,
        type: 'project',
        title: p.name,
        subtitle: p.status_name || null,
        url: `/projects/${p.id}`,
      });
    }

    for (const t of tasks) {
      results.push({
        id: t.id,
        type: 'task',
        title: t.title,
        subtitle: null,
        url: `/tasks`,
      });
    }

    return results.slice(0, limit);
  }
}
