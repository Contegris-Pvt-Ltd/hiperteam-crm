// ============================================================
// FILE: apps/web/src/features/forms/EngagementHubPage.tsx
//
// Engagement Hub — groups Forms + Scheduling under one view
// with sub-tabs. Renders as a wrapper around the active tab.
// ============================================================
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, CalendarClock } from 'lucide-react';
import { FormsPage } from './FormsPage';
import { SchedulingPage } from './SchedulingPage';

type Tab = 'forms' | 'scheduling';

const TABS: { key: Tab; label: string; icon: any; path: string }[] = [
  { key: 'forms', label: 'Forms', icon: FileText, path: '/engagement/forms' },
  { key: 'scheduling', label: 'Scheduling', icon: CalendarClock, path: '/engagement/scheduling' },
];

export function EngagementHubPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const resolveTab = (): Tab => {
    if (location.pathname.startsWith('/engagement/scheduling')) return 'scheduling';
    return 'forms';
  };

  const [activeTab, setActiveTab] = useState<Tab>(resolveTab);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, [location.pathname]);

  const switchTab = (tab: Tab) => {
    const t = TABS.find((t) => t.key === tab)!;
    navigate(t.path, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-slate-700">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'forms' && <FormsPage />}
      {activeTab === 'scheduling' && <SchedulingPage />}
    </div>
  );
}
