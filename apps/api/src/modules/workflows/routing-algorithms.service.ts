import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RoutingAlgorithmsService {
  constructor(private readonly dataSource: DataSource) {}

  // ============================================================
  // MAIN ENTRY — resolves to a single userId or null
  // ============================================================
  async resolve(
    schema: string,
    workflowId: string,
    actionId: string,
    config: any,
    payload: any,
  ): Promise<string | null> {
    const { algorithm, pool = [], weights = [] } = config;

    if (!pool.length) return null;

    switch (algorithm) {
      case 'round_robin':  return this.roundRobin(schema, actionId, pool);
      case 'weighted':     return this.weighted(pool, weights);
      case 'load_based':   return this.loadBased(schema, pool, payload);
      case 'territory':    return this.territory(schema, pool, payload, config);
      case 'skill_match':  return this.skillMatch(schema, pool, payload, config);
      case 'sticky':       return this.sticky(schema, pool, payload, config);
      default:             return pool[0] ?? null;
    }
  }

  // ── Round Robin ──────────────────────────────────────────────
  private async roundRobin(schema: string, actionId: string, pool: string[]): Promise<string> {
    // Use workflow_actions config to store the counter (avoids a separate table)
    const [row] = await this.dataSource.query(
      `SELECT config FROM "${schema}".workflow_actions WHERE id = $1`,
      [actionId],
    );
    const current = row?.config ?? {};
    const index = (current.round_robin_index ?? 0) % pool.length;
    const userId = pool[index];

    await this.dataSource.query(
      `UPDATE "${schema}".workflow_actions
       SET config = config || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify({ round_robin_index: index + 1 }), actionId],
    );

    return userId;
  }

  // ── Weighted Random ──────────────────────────────────────────
  private weighted(pool: string[], weights: { userId: string; weight: number }[]): string {
    const weightMap = new Map(weights.map(w => [w.userId, w.weight]));
    const total = pool.reduce((sum, id) => sum + (weightMap.get(id) ?? 1), 0);
    let rand = Math.random() * total;
    for (const id of pool) {
      rand -= weightMap.get(id) ?? 1;
      if (rand <= 0) return id;
    }
    return pool[pool.length - 1];
  }

  // ── Load Based (fewest open records) ────────────────────────
  private async loadBased(schema: string, pool: string[], payload: any): Promise<string> {
    const module = payload.triggerModule ?? 'leads';
    const table = module === 'leads' ? 'leads' :
                  module === 'contacts' ? 'contacts' :
                  module === 'opportunities' ? 'opportunities' : 'leads';

    const rows = await this.dataSource.query(
      `SELECT owner_id, COUNT(*) AS cnt
       FROM "${schema}".${table}
       WHERE owner_id = ANY($1) AND deleted_at IS NULL
       GROUP BY owner_id`,
      [pool],
    );

    const loadMap = new Map<string, number>(rows.map((r: any) => [r.owner_id, parseInt(r.cnt)]));
    // Users with 0 open records won't appear — seed them
    pool.forEach(id => { if (!loadMap.has(id)) loadMap.set(id, 0); });

    return [...loadMap.entries()].sort((a, b) => a[1] - b[1])[0][0];
  }

  // ── Territory Match ──────────────────────────────────────────
  private async territory(
    schema: string, pool: string[], payload: any, _config: any,
  ): Promise<string | null> {
    const entityCountry = payload.entity?.country_code ?? payload.entity?.country;
    const entityCity    = payload.entity?.city;
    if (!entityCountry) return pool[0] ?? null;

    const rows = await this.dataSource.query(
      `SELECT id, territory_tags FROM "${schema}".users
       WHERE id = ANY($1) AND deleted_at IS NULL`,
      [pool],
    );

    for (const row of rows) {
      const tags: string[] = row.territory_tags ?? [];
      if (
        tags.includes(entityCountry) ||
        (entityCity && tags.includes(entityCity))
      ) {
        return row.id;
      }
    }
    // Fallback: first in pool
    return pool[0] ?? null;
  }

  // ── Skill Match ──────────────────────────────────────────────
  private async skillMatch(
    schema: string, pool: string[], payload: any, _config: any,
  ): Promise<string | null> {
    const entityIndustry = payload.entity?.industry;
    if (!entityIndustry) return pool[0] ?? null;

    const rows = await this.dataSource.query(
      `SELECT id, skill_tags FROM "${schema}".users
       WHERE id = ANY($1) AND deleted_at IS NULL`,
      [pool],
    );

    for (const row of rows) {
      const tags: string[] = row.skill_tags ?? [];
      if (tags.some(t => t.toLowerCase() === entityIndustry.toLowerCase())) {
        return row.id;
      }
    }
    return pool[0] ?? null;
  }

  // ── Sticky (same owner as related account/contact) ───────────
  private async sticky(
    schema: string, pool: string[], payload: any, _config: any,
  ): Promise<string | null> {
    const entity = payload.entity ?? {};
    const accountId = entity.account_id ?? entity.accountId;
    const contactId = entity.contact_id ?? entity.contactId;

    let existingOwner: string | null = null;

    if (accountId) {
      const [row] = await this.dataSource.query(
        `SELECT owner_id FROM "${schema}".accounts WHERE id = $1`, [accountId],
      );
      existingOwner = row?.owner_id ?? null;
    } else if (contactId) {
      const [row] = await this.dataSource.query(
        `SELECT owner_id FROM "${schema}".contacts WHERE id = $1`, [contactId],
      );
      existingOwner = row?.owner_id ?? null;
    }

    if (existingOwner && pool.includes(existingOwner)) return existingOwner;
    return pool[0] ?? null;
  }
}
