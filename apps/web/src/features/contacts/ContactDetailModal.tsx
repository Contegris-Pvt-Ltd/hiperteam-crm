import { useState } from 'react';
import { 
  X, Mail, Phone, Building2, Globe, MapPin, 
  Linkedin, Twitter, Calendar, User, Pencil,
  PhoneOff, MailX, BellOff
} from 'lucide-react';
import type { Contact, CreateContactData } from '../../api/contacts.api';
import { contactsApi } from '../../api/contacts.api';

interface ContactDetailModalProps {
  contact: Contact;
  editMode: boolean;
  onClose: () => void;
  onSaved: () => void;
  onEdit: () => void;
}

export function ContactDetailModal({ contact, editMode, onClose, onSaved, onEdit }: ContactDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<CreateContactData>({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email || '',
    phone: contact.phone || '',
    mobile: contact.mobile || '',
    company: contact.company || '',
    jobTitle: contact.jobTitle || '',
    website: contact.website || '',
    addressLine1: contact.addressLine1 || '',
    addressLine2: contact.addressLine2 || '',
    city: contact.city || '',
    state: contact.state || '',
    postalCode: contact.postalCode || '',
    country: contact.country || '',
    source: contact.source || '',
    tags: contact.tags || [],
    notes: contact.notes || '',
    socialProfiles: contact.socialProfiles || {},
    doNotContact: contact.doNotContact,
    doNotEmail: contact.doNotEmail,
    doNotCall: contact.doNotCall,
  });

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await contactsApi.update(contact.id, formData);
      onSaved();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message[0] : message || 'Failed to update contact');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateContactData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getProfileCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-500';
    if (percentage >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getProfileCompletionBg = (percentage: number) => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (editMode) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Contact
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Mobile</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => handleChange('jobTitle', e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Contact Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Profile Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
              {contact.firstName[0]}{contact.lastName[0]}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {contact.firstName} {contact.lastName}
              </h3>
              {contact.jobTitle && (
                <p className="text-gray-500 dark:text-slate-400">{contact.jobTitle}</p>
              )}
              {contact.company && (
                <p className="text-gray-500 dark:text-slate-400 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {contact.company}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProfileCompletionBg(contact.profileCompletion)}`}
                    style={{ width: `${contact.profileCompletion}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${getProfileCompletionColor(contact.profileCompletion)}`}>
                  {contact.profileCompletion}%
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Profile complete</p>
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Contact Information
              </h4>
              {contact.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
                    <a href={`mailto:${contact.email}`} className="text-gray-900 dark:text-white hover:text-blue-600">
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Phone</p>
                    <a href={`tel:${contact.phone}`} className="text-gray-900 dark:text-white">
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}
              {contact.mobile && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Mobile</p>
                    <a href={`tel:${contact.mobile}`} className="text-gray-900 dark:text-white">
                      {contact.mobile}
                    </a>
                  </div>
                </div>
              )}
              {contact.website && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Website</p>
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-gray-900 dark:text-white hover:text-blue-600">
                      {contact.website}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Address
              </h4>
              {(contact.addressLine1 || contact.city || contact.country) ? (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-gray-900 dark:text-white">
                    {contact.addressLine1 && <p>{contact.addressLine1}</p>}
                    {contact.addressLine2 && <p>{contact.addressLine2}</p>}
                    <p>
                      {[contact.city, contact.state, contact.postalCode].filter(Boolean).join(', ')}
                    </p>
                    {contact.country && <p>{contact.country}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No address provided</p>
              )}
            </div>
          </div>

          {/* Social Profiles */}
          {contact.socialProfiles && Object.values(contact.socialProfiles).some(Boolean) && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Social Profiles
              </h4>
              <div className="flex gap-3">
                {contact.socialProfiles.linkedin && (
                  <a
                    href={contact.socialProfiles.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {contact.socialProfiles.twitter && (
                  <a
                    href={contact.socialProfiles.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center text-sky-600 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900/50"
                  >
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Communication Preferences */}
          {(contact.doNotContact || contact.doNotEmail || contact.doNotCall) && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Communication Preferences
              </h4>
              <div className="flex flex-wrap gap-2">
                {contact.doNotContact && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    <BellOff className="w-4 h-4" />
                    Do not contact
                  </span>
                )}
                {contact.doNotEmail && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    <MailX className="w-4 h-4" />
                    Do not email
                  </span>
                )}
                {contact.doNotCall && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    <PhoneOff className="w-4 h-4" />
                    Do not call
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Notes
              </h4>
              <p className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Meta Info */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Created {new Date(contact.createdAt).toLocaleDateString()}
              </div>
              {contact.owner && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Owner: {contact.owner.firstName} {contact.owner.lastName}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}