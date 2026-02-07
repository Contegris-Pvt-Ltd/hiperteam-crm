import { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import type { SelectOption } from './SearchableSelect';
import { accountsApi } from '../../api/accounts.api';

interface LinkAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (accountId: string, role: string, isPrimary: boolean) => Promise<void>;
  existingAccountIds?: string[];
}

export function LinkAccountModal({ isOpen, onClose, onLink, existingAccountIds = [] }: LinkAccountModalProps) {
  const [selectedAccount, setSelectedAccount] = useState<SelectOption | null>(null);
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (query: string): Promise<SelectOption[]> => {
    try {
      const response = await accountsApi.getAll({ search: query, limit: 10 });
      return response.data
        .filter(account => !existingAccountIds.includes(account.id))
        .map(account => ({
          id: account.id,
          label: account.name,
          sublabel: account.industry || account.accountType,
          imageUrl: account.logoUrl || undefined,
        }));
    } catch (error) {
      console.error('Failed to search accounts:', error);
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      setError('Please select an account');
      return;
    }

    setLinking(true);
    setError('');

    try {
      await onLink(selectedAccount.id, role, isPrimary);
      onClose();
      // Reset form
      setSelectedAccount(null);
      setRole('');
      setIsPrimary(false);
    } catch (err) {
      setError('Failed to link account');
    } finally {
      setLinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Link Account</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Search Account *
            </label>
            <SearchableSelect
              placeholder="Type to search accounts..."
              onSearch={handleSearch}
              onSelect={setSelectedAccount}
              minSearchLength={2}
            />
            {selectedAccount && (
              <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                {selectedAccount.imageUrl ? (
                  <img src={selectedAccount.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-semibold">
                    {selectedAccount.label[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{selectedAccount.label}</p>
                  {selectedAccount.sublabel && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">{selectedAccount.sublabel}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Role at Company
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Decision Maker, Technical Contact"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              This is the primary account for this contact
            </span>
          </label>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedAccount || linking}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {linking ? 'Linking...' : 'Link Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}