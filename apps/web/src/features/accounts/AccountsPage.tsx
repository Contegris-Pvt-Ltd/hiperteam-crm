import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Download, 
  Globe, Users,
  Eye, Pencil, Trash2, Building2, User
} from 'lucide-react';
import type { Account, AccountsQuery } from '../../api/accounts.api';
import { accountsApi } from '../../api/accounts.api';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';
//import { ACCOUNT_CLASSIFICATIONS } from '../../api/accounts.api';

export function AccountsPage() {
  const navigate = useNavigate();

  // ── DataTable: dynamic columns + user preferences ──
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('accounts');
  const tablePrefs = useTablePreferences('accounts', allColumns, defaultVisibleKeys);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [query, setQuery] = useState<AccountsQuery>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // ── Sync table preferences into query once loaded ──
  useEffect(() => {
    if (!tablePrefs.loading) {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn,
        sortOrder: tablePrefs.sortOrder,
      }));
    }
  }, [tablePrefs.loading]);

  useEffect(() => {
    if (tablePrefs.loading) return;
    fetchAccounts();
  }, [query, tablePrefs.loading]);

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
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounts</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {meta.total} {query.accountClassification === 'business' ? 'business' : query.accountClassification === 'individual' ? 'individual' : ''} accounts
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
        {/* Classification Filter — Add after search bar, before the existing filter/export buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setQuery({ ...query, accountClassification: undefined, page: 1 })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !query.accountClassification
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setQuery({ ...query, accountClassification: 'business', page: 1 })}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              query.accountClassification === 'business'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            <Building2 className="w-3 h-3" /> B2B
          </button>
          <button
            onClick={() => setQuery({ ...query, accountClassification: 'individual', page: 1 })}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              query.accountClassification === 'individual'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            <User className="w-3 h-3" /> B2C
          </button>
        </div>
      </div>

      {/* ── DataTable ── */}
      <DataTable<Account>
        module="accounts"
        allColumns={allColumns}
        defaultVisibleKeys={defaultVisibleKeys}
        data={accounts}
        loading={loading || columnsLoading}
        meta={meta}
        visibleColumns={tablePrefs.visibleColumns}
        sortColumn={query.sortBy || 'created_at'}
        sortOrder={query.sortOrder || 'DESC'}
        pageSize={query.limit || 20}
        columnWidths={tablePrefs.columnWidths}
        onSort={(col, order) => {
          setQuery(prev => ({ ...prev, sortBy: col, sortOrder: order, page: 1 }));
          tablePrefs.setSortColumn(col);
          tablePrefs.setSortOrder(order);
        }}
        onPageChange={(page) => setQuery(prev => ({ ...prev, page }))}
        onPageSizeChange={(size) => {
          setQuery(prev => ({ ...prev, limit: size, page: 1 }));
          tablePrefs.setPageSize(size);
        }}
        onColumnsChange={tablePrefs.setVisibleColumns}
        onColumnWidthsChange={tablePrefs.setColumnWidths}
        onRowClick={(row) => navigate(`/accounts/${row.id}`)}
        emptyMessage="No accounts found. Try adjusting your search or filters."
        renderCell={(col, value, row) => {
          const account = row;

          // Name column — logo + name + parent
          if (col.key === 'name') {
            return (
              <div className="flex items-center gap-3">
                {account.logoUrl ? (
                  <img src={account.logoUrl} alt={account.name} className="w-9 h-9 rounded-xl object-cover" />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-sm font-semibold">
                    {account.name?.[0] || '?'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{account.name}</p>
                  {account.parentAccount && (
                    <p className="text-xs text-gray-500 dark:text-slate-400">↳ {account.parentAccount.name}</p>
                  )}
                </div>
              </div>
            );
          }

          // Website column — clickable with globe icon
          if (col.key === 'website' && value) {
            const url = String(value);
            let hostname = url;
            try { hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch { /* keep raw */ }
            return (
              <a
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-300 hover:text-blue-600"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe className="w-3.5 h-3.5" />
                {hostname}
              </a>
            );
          }

          // Contacts count column — icon + number
          if (col.key === 'contactsCount') {
            return (
              <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-300">
                <Users className="w-3.5 h-3.5" />
                {account.contactsCount ?? 0}
              </span>
            );
          }

          // Account type column — colored badge
          if (col.key === 'accountType' && value) {
            const type = String(value);
            return (
              <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                type === 'customer' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                type === 'prospect' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                type === 'partner' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
              }`}>
                {type}
              </span>
            );
          }

          // Owner column
          if (col.key === 'ownerName' && account.owner) {
            return (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {account.owner.firstName} {account.owner.lastName}
              </span>
            );
          }

          return undefined; // default renderer
        }}
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link to={`/accounts/${row.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
              <Eye className="w-4 h-4" />
            </Link>
            <Link to={`/accounts/${row.id}/edit`} className="p-1.5 text-gray-400 hover:text-amber-600 rounded">
              <Pencil className="w-4 h-4" />
            </Link>
            <button onClick={() => setShowDeleteConfirm(row.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

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