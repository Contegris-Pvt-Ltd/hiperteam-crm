import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useThemeStore } from '../../stores/theme.store';
import { useSidebarStore } from '../../stores/sidebar.store';
import { usePermissions } from '../../hooks/usePermissions';
import { GlobalSearchBar } from './GlobalSearchModal';
import {
  Search,
  Plus,
  ChevronDown,
  Menu,
  Sun,
  Moon,
  Monitor,
  User,
  Settings,
  HelpCircle,
  Keyboard,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';

export function Header() {
  const { user, appConfig, logout } = useAuthStore();
  const { isAdmin } = usePermissions();
  const { theme, setTheme } = useThemeStore();
  const { setMobileOpen } = useSidebarStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const quickAddItems = [
    { name: 'Contact', href: '/contacts/new' },
    { name: 'Lead', href: '/leads/new' },
    { name: 'Opportunity', href: '/opportunities/new' },
    { name: 'Task', href: '/tasks/new' },
  ];

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="p-2 -ml-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white lg:hidden"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Search Bar - Desktop (inline) */}
      <div className="hidden md:block flex-1 max-w-xl">
        <GlobalSearchBar />
      </div>

      {/* Mobile Search Bar - full width below header */}
      {showMobileSearch && (
        <div className="absolute top-16 left-0 right-0 p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 z-40 md:hidden">
          <GlobalSearchBar />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto">
        {/* Mobile Search Toggle */}
        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl md:hidden"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Quick Add */}
        <div className="relative">
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
            <ChevronDown className="w-3 h-3 hidden sm:inline" />
          </button>

          {showQuickAdd && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowQuickAdd(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-2 z-20">
                {quickAddItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="block px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    onClick={() => setShowQuickAdd(false)}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-emerald-500/25">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500 hidden sm:block" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-2 z-20">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{user?.email}</p>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <a href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <User className="w-4 h-4" />
                    My Profile
                  </a>
                  {isAdmin && (
                    <a href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <Settings className="w-4 h-4" />
                      Settings
                    </a>
                  )}
                  <a
                    href={appConfig?.helpSupportUrl || 'https://docs-hiperteam.intellicon.io'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Help & Support
                    <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                  </a>
                  <button className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 w-full">
                    <Keyboard className="w-4 h-4" />
                    Keyboard Shortcuts
                    <kbd className="ml-auto px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono">?</kbd>
                  </button>
                </div>

                {/* Theme Switcher */}
                <div className="py-2 px-4 border-t border-gray-100 dark:border-slate-700">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Theme</p>
                  <div className="flex gap-1">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          theme === option.value
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <option.icon className="w-3.5 h-3.5" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logout */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
