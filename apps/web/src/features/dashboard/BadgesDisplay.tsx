// ============================================================
// FILE: apps/web/src/features/dashboard/BadgesDisplay.tsx
// ============================================================

import { useState, useEffect } from 'react';
import { Award, Clock, Flame, Star } from 'lucide-react';
import { gamificationApi } from '../../api/targets.api';
import type { BadgeAward, AchievementEntry } from '../../api/targets.api';

// ── Tier styling ──────────────────────────────────────────────
const TIER_STYLES: Record<string, { ring: string; bg: string; label: string }> = {
  bronze:   { ring: 'ring-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Bronze' },
  silver:   { ring: 'ring-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50', label: 'Silver' },
  gold:     { ring: 'ring-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', label: 'Gold' },
  platinum: { ring: 'ring-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', label: 'Platinum' },
  diamond:  { ring: 'ring-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', label: 'Diamond' },
};

function getTier(tier: string) {
  return TIER_STYLES[tier] || TIER_STYLES.bronze;
}

function timeAgo(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── MY BADGES WIDGET ──────────────────────────────────────────

interface MyBadgesWidgetProps {
  className?: string;
  userId?: string;  // optional: view another user's badges
}

export function MyBadgesWidget({ className = '', userId }: MyBadgesWidgetProps) {
  const [badges, setBadges] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = userId
      ? gamificationApi.getUserBadges(userId)
      : gamificationApi.getMyBadges();
    load.then(setBadges).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  const visible = showAll ? badges : badges.slice(0, 8);
  const totalPoints = badges.reduce((sum, b) => sum + b.pointsEarned, 0);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-32 mb-4" />
          <div className="flex gap-3">
            {[1,2,3].map(i => <div key={i} className="w-14 h-14 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Badges</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No badges earned yet. Hit your targets to earn badges!</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Badges
            <span className="ml-1.5 text-xs font-normal text-gray-400">({badges.length})</span>
          </h3>
        </div>
        {totalPoints > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
            <Star className="w-3.5 h-3.5" /> {totalPoints.toLocaleString()} pts
          </span>
        )}
      </div>

      {/* Badge grid */}
      <div className="flex flex-wrap gap-2">
        {visible.map((award) => {
          const tier = getTier(award.badge.tier);
          return (
            <div
              key={award.id}
              className={`relative group flex flex-col items-center p-2 rounded-xl ${tier.bg} ring-1 ${tier.ring} ring-opacity-30 hover:ring-opacity-60 transition-all cursor-default`}
              title={`${award.badge.name}: ${award.awardedFor}\n+${award.pointsEarned} pts`}
            >
              <span className="text-2xl">{award.badge.icon}</span>
              <span className="text-[9px] font-medium text-gray-600 dark:text-slate-400 mt-0.5 text-center max-w-[60px] truncate">
                {award.badge.name}
              </span>

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                  <p className="font-semibold">{award.badge.name}</p>
                  <p className="text-gray-300 text-[10px]">{award.awardedFor}</p>
                  <p className="text-yellow-400 text-[10px] mt-0.5">+{award.pointsEarned} pts · {timeAgo(award.awardedAt)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more */}
      {badges.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-blue-500 hover:text-blue-600"
        >
          {showAll ? 'Show less' : `+${badges.length - 8} more`}
        </button>
      )}
    </div>
  );
}

// ── ACHIEVEMENT FEED WIDGET ───────────────────────────────────

interface AchievementFeedProps {
  className?: string;
  userId?: string;
  limit?: number;
}

export function AchievementFeed({ className = '', userId, limit = 10 }: AchievementFeedProps) {
  const [achievements, setAchievements] = useState<AchievementEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamificationApi.getAchievements(userId, limit)
      .then(setAchievements)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, limit]);

  const EVENT_ICONS: Record<string, string> = {
    milestone_hit: '🎯',
    target_achieved: '🏆',
    badge_earned: '🏅',
    streak_extended: '🔥',
    streak_broken: '💔',
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 dark:bg-slate-800 rounded" />)}
        </div>
      </div>
    );
  }

  if (achievements.length === 0) return null;

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Achievements</h3>
      </div>

      <div className="space-y-2">
        {achievements.map(a => (
          <div key={a.id} className="flex items-start gap-2.5 py-1.5">
            <span className="text-base mt-0.5">{EVENT_ICONS[a.eventType] || '📌'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 dark:text-slate-300">
                {!userId && <span className="font-medium">{a.userName} </span>}
                {a.message}
              </p>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5" /> {timeAgo(a.createdAt)}
              </span>
            </div>
            {a.badge && (
              <span className="text-lg" title={a.badge.name}>{a.badge.icon}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── POINTS LEADERBOARD WIDGET ─────────────────────────────────

interface PointsLeaderboardProps {
  className?: string;
}

export function PointsLeaderboard({ className = '' }: PointsLeaderboardProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamificationApi.getLeaderboard()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || entries.length === 0) return null;

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-5 h-5 text-yellow-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Points Leaderboard</h3>
      </div>

      <div className="space-y-2">
        {entries.slice(0, 10).map(e => (
          <div key={e.userId} className="flex items-center gap-2.5 py-1">
            <span className="text-xs w-5 text-center font-medium text-gray-400">
              {e.rank <= 3 ? ['🥇','🥈','🥉'][e.rank - 1] : `#${e.rank}`}
            </span>
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-600">
              {e.name.charAt(0)}
            </div>
            <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{e.name}</span>
            <span className="text-xs font-medium text-yellow-600">{e.totalPoints} pts</span>
            {e.bestStreak > 0 && (
              <span className="text-[10px] text-amber-500">🔥{e.bestStreak}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}