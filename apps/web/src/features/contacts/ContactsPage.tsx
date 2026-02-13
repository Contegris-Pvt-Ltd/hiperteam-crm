import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Download, 
  Mail, Phone, Building2,
  Eye, Pencil, Trash2
} from 'lucide-react';
import type { Contact, ContactsQuery } from '../../api/contacts.api';
import { contactsApi } from '../../api/contacts.api';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';

export function ContactsPage() {
  const navigate = useNavigate();

  // ── DataTable: dynamic columns + user preferences ──
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('contacts');
  const tablePrefs = useTablePreferences('contacts', allColumns, defaultVisibleKeys);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [query, setQuery] = useState<ContactsQuery>({ page: 1, limit: 20 });
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
    fetchContacts();
  }, [query]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await contactsApi.getAll(query);
      setContacts(response.data);
      setMeta(response.meta);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery({ ...query, search: searchInput, page: 1 });
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await contactsApi.delete(id);
      setShowDeleteConfirm(null);
      fetchContacts();
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {meta.total} contacts total
          </p>
        </div>
        <Link
          to="/contacts/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </form>
      </div>

      {/* ── DataTable ── */}
      <DataTable<Contact>
        module="contacts"
        allColumns={allColumns}
        defaultVisibleKeys={defaultVisibleKeys}
        data={contacts}
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
        onRowClick={(row) => navigate(`/contacts/${row.id}`)}
        emptyMessage="No contacts found. Try adjusting your search or filters."
        renderCell={(col, value, row) => {
          const contact = row;

          // Name column — avatar + name + job title
          if (col.key === 'name') {
            return (
              <div className="flex items-center gap-3">
                {contact.avatarUrl ? (
                  <img
                    src={contact.avatarUrl}
                    alt={`${contact.firstName} ${contact.lastName}`}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {contact.firstName?.[0]}{contact.lastName?.[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {contact.firstName} {contact.lastName}
                  </p>
                  {contact.jobTitle && (
                    <p className="text-xs text-gray-500 dark:text-slate-400">{contact.jobTitle}</p>
                  )}
                </div>
              </div>
            );
          }

          // Company column — building icon
          if (col.key === 'company' && value) {
            return (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                {String(value)}
              </div>
            );
          }

          // Email column — mail icon
          if (col.key === 'email' && value) {
            return (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                {String(value)}
              </div>
            );
          }

          // Phone column — phone icon
          if (col.key === 'phone' && value) {
            return (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                {String(value)}
              </div>
            );
          }

          // Status column — colored badge
          if (col.key === 'status' && value) {
            const status = String(value);
            return (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium ${
                status === 'active'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
              }`}>
                {status}
              </span>
            );
          }

          // Owner column
          if (col.key === 'ownerName' && contact.owner) {
            return (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {contact.owner.firstName} {contact.owner.lastName}
              </span>
            );
          }

          return undefined; // default renderer
        }}
        renderActions={(row) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link to={`/contacts/${row.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded">
              <Eye className="w-4 h-4" />
            </Link>
            <Link to={`/contacts/${row.id}/edit`} className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded">
              <Pencil className="w-4 h-4" />
            </Link>
            <button onClick={() => setShowDeleteConfirm(row.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Contact
            </h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete this contact? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteContact(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}