import { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Download, MoreHorizontal, 
  Mail, Phone, Building2, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2
} from 'lucide-react';
import type { Contact, ContactsQuery } from '../../api/contacts.api';
import { contactsApi } from '../../api/contacts.api';
import { ContactModal } from './ContactModal';
import { ContactDetailModal } from './ContactDetailModal';

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [query, setQuery] = useState<ContactsQuery>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

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

  const handlePageChange = (newPage: number) => {
    setQuery({ ...query, page: newPage });
  };

  const handleViewContact = (contact: Contact) => {
    setSelectedContact(contact);
    setEditMode(false);
    setShowDetailModal(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setEditMode(true);
    setShowDetailModal(true);
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

  const handleContactSaved = () => {
    setShowCreateModal(false);
    setShowDetailModal(false);
    setSelectedContact(null);
    fetchContacts();
  };

  const getProfileCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Manage your contacts and relationships
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
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

      {/* Contacts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No contacts yet</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Get started by adding your first contact to build your network.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Your First Contact
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Profile
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => handleViewContact(contact)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {contact.firstName[0]}{contact.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {contact.firstName} {contact.lastName}
                            </p>
                            {contact.jobTitle && (
                              <p className="text-sm text-gray-500 dark:text-slate-400">
                                {contact.jobTitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {contact.company && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-slate-300">
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                            {contact.company}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                              <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                              {contact.email}
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                              <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProfileCompletionColor(contact.profileCompletion)} transition-all`}
                              style={{ width: `${contact.profileCompletion}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            {contact.profileCompletion}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                          contact.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                        }`}>
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewContact(contact)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditContact(contact)}
                            className="p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(contact.id)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-800">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  onClick={() => handleViewContact(contact)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {contact.firstName} {contact.lastName}
                      </p>
                      {contact.jobTitle && (
                        <p className="text-sm text-gray-500 dark:text-slate-400">{contact.jobTitle}</p>
                      )}
                      {contact.company && (
                        <p className="text-sm text-gray-500 dark:text-slate-400">{contact.company}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getProfileCompletionColor(contact.profileCompletion)}`}
                            style={{ width: `${contact.profileCompletion}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {contact.profileCompletion}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Show mobile menu
                      }}
                      className="p-2 text-gray-400"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Showing {((meta.page - 1) * meta.limit) + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} contacts
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(meta.page - 1)}
                    disabled={meta.page === 1}
                    className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                  </button>
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    Page {meta.page} of {meta.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(meta.page + 1)}
                    disabled={meta.page === meta.totalPages}
                    className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ContactModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleContactSaved}
        />
      )}

      {/* Detail/Edit Modal */}
      {showDetailModal && selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          editMode={editMode}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedContact(null);
          }}
          onSaved={handleContactSaved}
          onEdit={() => setEditMode(true)}
        />
      )}

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