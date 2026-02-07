import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Download, 
  Globe, Users, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2, Building2
} from 'lucide-react';
import type { Account, AccountsQuery } from '../../api/accounts.api';
import { accountsApi } from '../../api/accounts.api';

export function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [query, setQuery] = useState<AccountsQuery>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [query]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await accountsApi.getAll(query);
      setAccounts(response.data);
      setMeta(response.meta);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery({ ...query, search: searchInput, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setQuery({ ...query, page: newPage });
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      await accountsApi.delete(id);
      setShowDeleteConfirm(null);
      fetchAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounts</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {meta.total} accounts total
          </p>
        </div>
        <Link
          to="/accounts/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300">
              <Search className="w-4 h-4" />
              Search
            </button>
            <button type="button" className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-600 dark:text-slate-400">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button type="button" className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-600 dark:text-slate-400">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </form>
      </div>

      {/* Accounts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No accounts yet</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Get started by adding your first account.
            </p>
            <Link to="/accounts/new" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">
              <Plus className="w-4 h-4" />
              Add Your First Account
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Account</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Industry</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Website</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Contacts</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {accounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate(`/accounts/${account.id}`)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {account.logoUrl ? (
                            <img src={account.logoUrl} alt={account.name} className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                              {account.name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                            {account.parentAccount && (
                              <p className="text-sm text-gray-500 dark:text-slate-400">↳ {account.parentAccount.name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-slate-300">{account.industry || '—'}</td>
                      <td className="px-6 py-4">
                        {account.website && (
                          <a href={account.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-600 dark:text-slate-300 hover:text-blue-600" onClick={e => e.stopPropagation()}>
                            <Globe className="w-4 h-4" />
                            {new URL(account.website).hostname}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300">
                          <Users className="w-4 h-4" />
                          {account.contactsCount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${
                          account.accountType === 'customer' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                          account.accountType === 'prospect' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                        }`}>
                          {account.accountType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Link to={`/accounts/${account.id}`} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg"><Eye className="w-4 h-4" /></Link>
                          <Link to={`/accounts/${account.id}/edit`} className="p-2 text-gray-400 hover:text-amber-600 rounded-lg"><Pencil className="w-4 h-4" /></Link>
                          <button onClick={() => setShowDeleteConfirm(account.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
              {accounts.map((account) => (
                <Link key={account.id} to={`/accounts/${account.id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    {account.logoUrl ? (
                      <img src={account.logoUrl} alt={account.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-semibold">
                        {account.name[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{account.name}</p>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{account.industry || account.accountType}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {((meta.page - 1) * meta.limit) + 1} - {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePageChange(meta.page - 1)} disabled={meta.page === 1} className="p-2 border rounded-lg disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm">{meta.page} / {meta.totalPages}</span>
                  <button onClick={() => handlePageChange(meta.page + 1)} disabled={meta.page === meta.totalPages} className="p-2 border rounded-lg disabled:opacity-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Account</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">Are you sure? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 border rounded-xl">Cancel</button>
              <button onClick={() => handleDeleteAccount(showDeleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}