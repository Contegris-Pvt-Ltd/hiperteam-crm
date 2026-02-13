// ============================================================
// FILE: apps/api/src/modules/leads/lead-scoring.service.ts
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface ScoringRule {
  id: string;
  name: string;
  category: string;
  type: string;
  field_key: string;
  operator: string;
  value: any;
  score_delta: number;
}

@Injectable()
export class LeadScoringService {
  private readonly logger = new Logger(LeadScoringService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Score a single lead based on active scoring template rules
   */
  async scoreLead(schemaName: string, leadId: string): Promise<{ score: number; breakdown: Record<string, any> }> {
    // Get the lead
    const [lead] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".leads WHERE id = $1 AND deleted_at IS NULL`,
      [leadId],
    );
    if (!lead) return { score: 0, breakdown: {} };

    // Get active default template
    const [template] = await this.dataSource.query(
      `SELECT id, max_score FROM "${schemaName}".lead_scoring_templates
       WHERE is_active = true AND is_default = true LIMIT 1`,
    );
    if (!template) return { score: 0, breakdown: {} };

    // Get all active rules for this template
    const rules: ScoringRule[] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_scoring_rules
       WHERE template_id = $1 AND is_active = true
       ORDER BY sort_order ASC`,
      [template.id],
    );

    let totalScore = 0;
    const breakdown: Record<string, any> = {};

    // Parse lead JSON fields
    const qualification = typeof lead.qualification === 'string'
      ? JSON.parse(lead.qualification) : (lead.qualification || {});
    const customFields = typeof lead.custom_fields === 'string'
      ? JSON.parse(lead.custom_fields) : (lead.custom_fields || {});

    for (const rule of rules) {
      const matched = this.evaluateRule(lead, qualification, customFields, rule);

      if (matched) {
        totalScore += rule.score_delta;
        breakdown[rule.name] = {
          ruleId: rule.id,
          category: rule.category,
          fieldKey: rule.field_key,
          delta: rule.score_delta,
          matched: true,
        };
      }
    }

    // Clamp score to [0, maxScore]
    const maxScore = template.max_score || 100;
    const finalScore = Math.max(0, Math.min(maxScore, totalScore));

    // Update lead
    await this.dataSource.query(
      `UPDATE "${schemaName}".leads SET score = $1, score_breakdown = $2 WHERE id = $3`,
      [finalScore, JSON.stringify(breakdown), leadId],
    );

    return { score: finalScore, breakdown };
  }

  /**
   * Re-score all active leads (e.g., when rules change)
   */
  async rescoreAll(schemaName: string): Promise<{ processed: number }> {
    const leads = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".leads
       WHERE deleted_at IS NULL AND converted_at IS NULL AND disqualified_at IS NULL`,
    );

    let processed = 0;
    for (const lead of leads) {
      await this.scoreLead(schemaName, lead.id);
      processed++;
    }

    this.logger.log(`Rescored ${processed} leads in schema ${schemaName}`);
    return { processed };
  }

  /**
   * Evaluate a single scoring rule against a lead
   */
  private evaluateRule(
    lead: Record<string, any>,
    qualification: Record<string, any>,
    customFields: Record<string, any>,
    rule: ScoringRule,
  ): boolean {
    const fieldKey = rule.field_key;
    let value: any;

    // Resolve field value from nested paths
    if (fieldKey.startsWith('qualification.')) {
      value = qualification[fieldKey.replace('qualification.', '')];
    } else if (fieldKey.startsWith('custom.') || fieldKey.startsWith('customFields.')) {
      const key = fieldKey.replace('custom.', '').replace('customFields.', '');
      value = customFields[key];
    } else {
      // Direct lead field (snake_case in DB)
      value = lead[fieldKey] ?? lead[this.camelToSnake(fieldKey)];
    }

    const targetValue = rule.value;

    switch (rule.operator) {
      case 'equals':
        return String(value || '').toLowerCase() === String(targetValue).toLowerCase();

      case 'not_equals':
        return String(value || '').toLowerCase() !== String(targetValue).toLowerCase();

      case 'contains':
        return String(value || '').toLowerCase().includes(String(targetValue).toLowerCase());

      case 'contains_any': {
        const targets = Array.isArray(targetValue) ? targetValue : JSON.parse(targetValue || '[]');
        const valLower = String(value || '').toLowerCase();
        return targets.some((t: string) => valLower.includes(t.toLowerCase()));
      }

      case 'in': {
        const list = Array.isArray(targetValue) ? targetValue : JSON.parse(targetValue || '[]');
        return list.includes(value);
      }

      case 'is_not_empty':
        return value !== null && value !== undefined && String(value).trim() !== '';

      case 'is_empty':
        return !value || String(value).trim() === '';

      case 'greater_than':
        return Number(value) > Number(targetValue);

      case 'less_than':
        return Number(value) < Number(targetValue);

      case 'older_than': {
        // For decay rules: check if date field is older than N days
        if (!value) return true; // No activity → decay applies
        const days = parseInt(targetValue, 10);
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);
        return new Date(value) < threshold;
      }

      default:
        return false;
    }
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
