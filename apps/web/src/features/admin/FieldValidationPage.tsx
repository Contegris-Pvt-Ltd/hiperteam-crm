// ============================================================
// NEW FILE: apps/web/src/features/admin/FieldValidationPage.tsx
// ============================================================
// Admin page for configuring field validation across all modules.
// Accessible from AdminLayout sidebar.
// ============================================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, Users, Building2, Target, Briefcase,
} from 'lucide-react';
import { FieldValidationTab } from './FieldValidationTab';

const MODULES = [
  { id: 'leads', label: 'Leads', icon: Target },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'accounts', label: 'Accounts', icon: Building2 },
  { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
] as const;

type ModuleId = typeof MODULES[number]['id'];

export function FieldValidationPage() {
  const [activeModule, setActiveModule] = useState<ModuleId>('leads');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 mb-3"
        >
          <ArrowLeft size={14} /> Back to Admin
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield size={22} /> Field Validation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure which fields are required when creating records in each module.
          Rules are enforced on both the form and the API.
        </p>
      </div>

      {/* Module tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4 overflow-x-auto">
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id)}
                className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeModule === mod.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {mod.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Module-specific content */}
      <FieldValidationTab module={activeModule} />
    </div>
  );
}