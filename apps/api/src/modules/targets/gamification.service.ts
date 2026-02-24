// ============================================================
// FILE: apps/api/src/modules/targets/gamification.service.ts
// ============================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // BADGE DEFINITIONS (Admin CRUD)
  // ============================================================

  async getBadges(schema: string) {
    const badges = await this.dataSource.query(
      `SELECT * FROM "${schema}".badges ORDER BY tier, name`,
    );
    return badges.map((b: any) => this.formatBadge(b));
  }

  async createBadge(schema: string, dto: any) {
    const [badge] = await this.dataSource.query(
      `INSERT INTO "${schema}".badges
       (name, description, icon, color, trigger_type, trigger_config, tier, points, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
       RETURNING *`,
      [
        dto.name, dto.description || null, dto.icon || '🏆',
        dto.color || '#F59E0B', dto.triggerType,
        JSON.stringify(dto.triggerConfig || {}),
        dto.tier || 'bronze', dto.points || 10,
      ],
    );
    return this.formatBadge(badge);
  }

  async updateBadge(schema: string, id: string, dto: any) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', description: 'description', icon: 'icon',
      color: 'color', tier: 'tier', points: 'points', isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (dto[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(dto[key]);
        idx++;
      }
    }

    if (dto.triggerConfig !== undefined) {
      sets.push(`trigger_config = $${idx}`);
      params.push(JSON.stringify(dto.triggerConfig));
      idx++;
    }

    if (sets.length === 0) return this.getBadgeById(schema, id);

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schema}".badges SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!updated) throw new NotFoundException('Badge not found');
    return this.formatBadge(updated);
  }

  async deleteBadge(schema: string, id: string) {
    // Don't allow deleting system badges
    const [badge] = await this.dataSource.query(
      `SELECT is_system FROM "${schema}".badges WHERE id = $1`, [id],
    );
    if (badge?.is_system) {
      // Just deactivate system badges
      await this.dataSource.query(
        `UPDATE "${schema}".badges SET is_active = false WHERE id = $1`, [id],
      );
      return { success: true, deactivated: true };
    }
    await this.dataSource.query(`DELETE FROM "${schema}".badges WHERE id = $1`, [id]);
    return { success: true };
  }

  private async getBadgeById(schema: string, id: string) {
    const [badge] = await this.dataSource.query(
      `SELECT * FROM "${schema}".badges WHERE id = $1`, [id],
    );
    if (!badge) throw new NotFoundException('Badge not found');
    return this.formatBadge(badge);
  }

  // ============================================================
  // BADGE CHECKING & AWARDING
  // ============================================================

  /**
   * Called after progress is computed. Checks all badge triggers.
   */
  async checkAndAwardBadges(
    schema: string,
    userId: string,
    assignmentId: string,
    percentage: number,
    metricKey: string,
  ): Promise<any[]> {
    const awarded: any[] = [];

    // Get all active badges
    const badges = await this.dataSource.query(
      `SELECT * FROM "${schema}".badges WHERE is_active = true`,
    );

    for (const badge of badges) {
      const config = badge.trigger_config || {};

      switch (badge.trigger_type) {
        case 'target_achieved': {
          if (percentage >= (config.percentage || 100)) {
            const award = await this.awardBadge(schema, badge, userId, assignmentId,
              `Achieved ${Math.round(percentage)}% of target`);
            if (award) awarded.push(award);
          }
          break;
        }

        case 'milestone': {
          if (config.metric_key === metricKey && config.lifetime_count) {
            const lifetime = await this.getLifetimeCount(schema, metricKey, userId);
            if (lifetime >= config.lifetime_count) {
              const award = await this.awardBadge(schema, badge, userId, null,
                `Reached ${config.lifetime_count} lifetime ${metricKey}`);
              if (award) awarded.push(award);
            }
          }
          break;
        }

        // Streak badges are handled in updateStreak()
        // Custom badges are handled in checkCustomBadges()
      }
    }

    return awarded;
  }

  /**
   * Award a badge to a user. Returns null if already awarded for the same assignment.
   */
  private async awardBadge(
    schema: string, badge: any, userId: string,
    assignmentId: string | null, reason: string,
  ): Promise<any | null> {
    try {
      // Check if already awarded (for non-repeatable badges)
      if (assignmentId) {
        const [existing] = await this.dataSource.query(
          `SELECT id FROM "${schema}".badge_awards
           WHERE badge_id = $1 AND user_id = $2 AND target_assignment_id = $3`,
          [badge.id, userId, assignmentId],
        );
        if (existing) return null;
      } else {
        // Lifetime badges: check if already awarded (any context)
        const [existing] = await this.dataSource.query(
          `SELECT id FROM "${schema}".badge_awards
           WHERE badge_id = $1 AND user_id = $2 AND target_assignment_id IS NULL`,
          [badge.id, userId],
        );
        if (existing) return null;
      }

      const [award] = await this.dataSource.query(
        `INSERT INTO "${schema}".badge_awards
         (badge_id, user_id, awarded_for, target_assignment_id, points_earned)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [badge.id, userId, reason, assignmentId, badge.points],
      );

      // Log achievement
      await this.dataSource.query(
        `INSERT INTO "${schema}".achievement_log
         (user_id, event_type, event_data, badge_id, message)
         VALUES ($1, 'badge_earned', $2, $3, $4)`,
        [
          userId,
          JSON.stringify({ badgeId: badge.id, points: badge.points }),
          badge.id,
          `🏅 New badge: ${badge.name}! ${badge.description || ''}`,
        ],
      );

      // Notification
      this.emitNotification(schema, userId,
        `🏅 New badge: ${badge.name}`,
        `${badge.description || reason}. +${badge.points} points!`,
      );

      return {
        id: award.id,
        badge: this.formatBadge(badge),
        awardedFor: reason,
        pointsEarned: badge.points,
        awardedAt: award.awarded_at,
      };
    } catch (err) {
      // Unique constraint violation = already awarded
      this.logger.debug(`Badge ${badge.name} already awarded to ${userId}`, err);
      return null;
    }
  }

  // ============================================================
  // STREAK MANAGEMENT
  // ============================================================

  /**
   * Called at end of period (or when target is first achieved).
   * Updates streak count and checks for streak badges.
   */
  async updateStreak(schema: string, userId: string, targetId: string, achieved: boolean, periodStart: string) {
    // Upsert streak record
    const [streak] = await this.dataSource.query(
      `INSERT INTO "${schema}".user_streaks (user_id, target_id, current_streak, longest_streak, last_achieved_period)
       VALUES ($1, $2, 0, 0, NULL)
       ON CONFLICT (user_id, target_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId, targetId],
    );

    if (achieved) {
      const newStreak = streak.current_streak + 1;
      const newLongest = Math.max(newStreak, streak.longest_streak);

      await this.dataSource.query(
        `UPDATE "${schema}".user_streaks
         SET current_streak = $1, longest_streak = $2, last_achieved_period = $3, updated_at = NOW()
         WHERE user_id = $4 AND target_id = $5`,
        [newStreak, newLongest, periodStart, userId, targetId],
      );

      // Log streak
      await this.dataSource.query(
        `INSERT INTO "${schema}".achievement_log
         (user_id, event_type, event_data, target_id, message)
         VALUES ($1, 'streak_extended', $2, $3, $4)`,
        [
          userId,
          JSON.stringify({ streak: newStreak, longest: newLongest }),
          targetId,
          `🔥 ${newStreak}-period streak!`,
        ],
      );

      // Check streak badges
      await this.checkStreakBadges(schema, userId, targetId, newStreak);

      return { currentStreak: newStreak, longestStreak: newLongest };
    } else {
      // Streak broken
      if (streak.current_streak > 0) {
        await this.dataSource.query(
          `UPDATE "${schema}".user_streaks
           SET current_streak = 0, updated_at = NOW()
           WHERE user_id = $1 AND target_id = $2`,
          [userId, targetId],
        );

        await this.dataSource.query(
          `INSERT INTO "${schema}".achievement_log
           (user_id, event_type, event_data, target_id, message)
           VALUES ($1, 'streak_broken', $2, $3, $4)`,
          [
            userId,
            JSON.stringify({ previousStreak: streak.current_streak }),
            targetId,
            `Streak ended at ${streak.current_streak}. Start a new one!`,
          ],
        );
      }
      return { currentStreak: 0, longestStreak: streak.longest_streak };
    }
  }

  private async checkStreakBadges(schema: string, userId: string, targetId: string, streakCount: number) {
    const badges = await this.dataSource.query(
      `SELECT * FROM "${schema}".badges
       WHERE trigger_type = 'streak' AND is_active = true`,
    );

    for (const badge of badges) {
      const config = badge.trigger_config || {};
      if (streakCount >= (config.streak_count || 999)) {
        await this.awardBadge(schema, badge, userId, null,
          `${streakCount}-period streak on target`);
      }
    }
  }

  // ============================================================
  // CUSTOM BADGE CHECKS
  // ============================================================

  async checkCustomBadges(schema: string, userId: string, assignmentId: string, progress: any) {
    const badges = await this.dataSource.query(
      `SELECT * FROM "${schema}".badges
       WHERE trigger_type = 'custom' AND is_active = true`,
    );

    for (const badge of badges) {
      const config = badge.trigger_config || {};

      switch (config.rule) {
        case 'achieved_before_half_period': {
          const halfDays = Math.floor(progress.daysTotal / 2);
          if (progress.percentage >= 100 && progress.daysElapsed <= halfDays) {
            await this.awardBadge(schema, badge, userId, assignmentId,
              'Hit target before period midpoint');
          }
          break;
        }
        case 'was_behind_then_achieved': {
          // Check if there's a past 'at_risk' or 'behind' log entry for this assignment
          const [wasBehind] = await this.dataSource.query(
            `SELECT id FROM "${schema}".achievement_log
             WHERE user_id = $1 AND event_type = 'milestone_hit'
             AND event_data->>'assignmentId' = $2
             AND (event_data->>'pace_was' = 'behind' OR event_data->>'pace_was' = 'at_risk')
             LIMIT 1`,
            [userId, assignmentId],
          );
          if (wasBehind && progress.percentage >= 100) {
            await this.awardBadge(schema, badge, userId, assignmentId,
              'Came from behind to hit target');
          }
          break;
        }
      }
    }
  }

  // ============================================================
  // QUERIES
  // ============================================================

  async getUserBadges(schema: string, userId: string) {
    const awards = await this.dataSource.query(
      `SELECT ba.*, b.name, b.description, b.icon, b.color, b.tier, b.trigger_type
       FROM "${schema}".badge_awards ba
       JOIN "${schema}".badges b ON ba.badge_id = b.id
       WHERE ba.user_id = $1
       ORDER BY ba.awarded_at DESC`,
      [userId],
    );
    return awards.map((a: any) => ({
      id: a.id,
      badge: {
        id: a.badge_id, name: a.name, description: a.description,
        icon: a.icon, color: a.color, tier: a.tier,
      },
      awardedFor: a.awarded_for,
      pointsEarned: a.points_earned,
      awardedAt: a.awarded_at,
    }));
  }

  async getUserStreaks(schema: string, userId: string) {
    const streaks = await this.dataSource.query(
      `SELECT us.*, t.name as target_name, t.metric_key, t.period
       FROM "${schema}".user_streaks us
       JOIN "${schema}".targets t ON us.target_id = t.id
       WHERE us.user_id = $1
       ORDER BY us.current_streak DESC`,
      [userId],
    );
    return streaks.map((s: any) => ({
      targetId: s.target_id,
      targetName: s.target_name,
      metricKey: s.metric_key,
      period: s.period,
      currentStreak: s.current_streak,
      longestStreak: s.longest_streak,
      lastAchievedPeriod: s.last_achieved_period,
    }));
  }

  async getLeaderboard(schema: string, period?: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    console.log(period)
    const rows = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.avatar_url,
              COALESCE(SUM(ba.points_earned), 0) as total_points,
              COUNT(ba.id) as badges_earned,
              (SELECT MAX(us.current_streak)
               FROM "${schema}".user_streaks us WHERE us.user_id = u.id) as best_streak
       FROM "${schema}".users u
       LEFT JOIN "${schema}".badge_awards ba ON ba.user_id = u.id
         AND ba.awarded_at >= $1 AND ba.awarded_at <= $2
       WHERE u.status = 'active' AND u.deleted_at IS NULL
       GROUP BY u.id, u.first_name, u.last_name, u.avatar_url
       HAVING COALESCE(SUM(ba.points_earned), 0) > 0
       ORDER BY total_points DESC
       LIMIT 20`,
      [monthStart.toISOString(), monthEnd.toISOString()],
    );

    return rows.map((r: any, idx: number) => ({
      rank: idx + 1,
      userId: r.id,
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      avatarUrl: r.avatar_url,
      totalPoints: Number(r.total_points),
      badgesEarned: Number(r.badges_earned),
      bestStreak: r.best_streak || 0,
    }));
  }

  async getAchievementFeed(schema: string, userId?: string, limit = 20) {
    let where = '';
    const params: any[] = [limit];

    if (userId) {
      where = 'AND al.user_id = $2';
      params.push(userId);
    }

    const rows = await this.dataSource.query(
      `SELECT al.*, u.first_name, u.last_name, u.avatar_url,
              b.name as badge_name, b.icon as badge_icon, b.color as badge_color
       FROM "${schema}".achievement_log al
       JOIN "${schema}".users u ON al.user_id = u.id
       LEFT JOIN "${schema}".badges b ON al.badge_id = b.id
       WHERE 1=1 ${where}
       ORDER BY al.created_at DESC
       LIMIT $1`,
      params,
    );

    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userName: `${r.first_name} ${r.last_name || ''}`.trim(),
      avatarUrl: r.avatar_url,
      eventType: r.event_type,
      message: r.message,
      badge: r.badge_name ? { name: r.badge_name, icon: r.badge_icon, color: r.badge_color } : null,
      createdAt: r.created_at,
    }));
  }

  // ============================================================
  // LIFETIME COUNT (for milestone badges)
  // ============================================================

  private async getLifetimeCount(schema: string, metricKey: string, userId: string): Promise<number> {
    // Map metric_key to a lifetime query
    const queries: Record<string, string> = {
      opps_won: `SELECT COUNT(*) as value FROM "${schema}".opportunities WHERE deleted_at IS NULL AND won_at IS NOT NULL AND owner_id = $1`,
      leads_created: `SELECT COUNT(*) as value FROM "${schema}".leads WHERE deleted_at IS NULL AND owner_id = $1`,
      calls_made: `SELECT COUNT(*) as value FROM "${schema}".activities WHERE activity_type = 'call' AND performed_by = $1`,
      emails_sent: `SELECT COUNT(*) as value FROM "${schema}".activities WHERE activity_type IN ('email','email_sent') AND performed_by = $1`,
      meetings_held: `SELECT COUNT(*) as value FROM "${schema}".activities WHERE activity_type = 'meeting' AND performed_by = $1`,
      tasks_completed: `SELECT COUNT(*) as value FROM "${schema}".tasks WHERE deleted_at IS NULL AND completed_at IS NOT NULL AND assigned_to = $1`,
    };

    const query = queries[metricKey];
    if (!query) return 0;

    const [result] = await this.dataSource.query(query, [userId]);
    return Number(result?.value || 0);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private formatBadge(b: any) {
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      color: b.color,
      triggerType: b.trigger_type,
      triggerConfig: b.trigger_config,
      tier: b.tier,
      points: b.points,
      isActive: b.is_active,
      isSystem: b.is_system,
    };
  }

  private emitNotification(schema: string, userId: string, title: string, message: string) {
    this.dataSource.query(
      `INSERT INTO "${schema}".notifications (user_id, title, message, type, category)
       VALUES ($1, $2, $3, 'info', 'gamification')`,
      [userId, title, message],
    ).catch(() => { /* notification table might not exist yet */ });
  }
}