import { useState } from 'react';
import { X, User } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import type { SelectOption } from './SearchableSelect';
import { contactsApi } from '../../api/contacts.api';

interface LinkContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (contactId: string, role: string, isPrimary: boolean) => Promise<void>;
  existingContactIds?: string[];
}

export function LinkContactModal({ isOpen, onClose, onLink, existingContactIds = [] }: LinkContactModalProps) {
  const [selectedContact, setSelectedContact] = useState<SelectOption | null>(null);
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (query: string): Promise<SelectOption[]> => {
    try {
      const response = await contactsApi.getAll({ search: query, limit: 10 });
      return response.data
        .filter(contact => !existingContactIds.includes(contact.id))
        .map(contact => ({
          id: contact.id,
          label: `${contact.firstName} ${contact.lastName}`,
          sublabel: contact.jobTitle || contact.email || undefined,
          imageUrl: contact.avatarUrl || undefined,
        }));
    } catch (error) {
      console.error('Failed to search contacts:', error);
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) {
      setError('Please select a contact');
      return;
    }

    setLinking(true);
    setError('');

    try {
      await onLink(selectedContact.id, role, isPrimary);
      onClose();
      // Reset form
      setSelectedContact(null);
      setRole('');
      setIsPrimary(false);
    } catch (err) {
      setError('Failed to link contact');
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
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Link Contact</h2>
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
              Search Contact *
            </label>
            <SearchableSelect
              placeholder="Type to search contacts..."
              onSearch={handleSearch}
              onSelect={setSelectedContact}
              minSearchLength={2}
              renderOption={(option) => (
                <div className="flex items-center gap-3">
                  {option.imageUrl ? (
                    <img src={option.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {option.label.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{option.label}</p>
                    {option.sublabel && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{option.sublabel}</p>
                    )}
                  </div>
                </div>
              )}
            />
            {selectedContact && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
                {selectedContact.imageUrl ? (
                  <img src={selectedContact.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                    {selectedContact.label.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{selectedContact.label}</p>
                  {selectedContact.sublabel && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">{selectedContact.sublabel}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Role
            </label>
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Decision Maker, Technical Contact"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              This is the primary contact for this account
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
              disabled={!selectedContact || linking}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {linking ? 'Linking...' : 'Link Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}