import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Loader2,
  ExternalLink,
  Eye,
  Copy,
  Users,
  Clock,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { schedulingApi } from '../../api/scheduling.api';
import type { BookingFormSummary, FormBooking } from '../../api/scheduling.api';
import { useAuthStore } from '../../stores/auth.store';

type View = 'pages' | 'bookings';

export function SchedulingPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [view, setView] = useState<View>('pages');
  const [forms, setForms] = useState<BookingFormSummary[]>([]);
  const [bookings, setBookings] = useState<FormBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingStatus, setBookingStatus] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });

  useEffect(() => {
    if (view === 'pages') loadForms();
    else loadBookings();
  }, [view, bookingStatus]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const data = await schedulingApi.listBookingForms();
      setForms(data);
    } catch (err) {
      console.error('Failed to load booking forms', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async (page = 1) => {
    setLoading(true);
    try {
      const res = await schedulingApi.listBookings({
        status: bookingStatus || undefined,
        page,
        limit: 25,
      });
      setBookings(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (form: BookingFormSummary) =>
    `${window.location.origin}/book/${form.tenantSlug}/${form.token}`;

  const copyLink = (form: BookingFormSummary) => {
    navigator.clipboard.writeText(getPublicUrl(form));
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      rescheduled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      no_show: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || ''}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('pages')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'pages'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Booking Pages
          </button>
          <button
            onClick={() => setView('bookings')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'bookings'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Bookings
          </button>
        </div>

        {view === 'bookings' && (
          <select
            value={bookingStatus}
            onChange={(e) => setBookingStatus(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        )}
      </div>

      {/* My Availability quick-link */}
      {currentUser && (
        <button
          onClick={() => navigate(`/users/${currentUser.id}`, { state: { tab: 'availability' } })}
          className="w-full flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors"
        >
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="flex-1 text-left text-sm font-medium text-purple-700 dark:text-purple-300">
            Set your personal availability for meeting bookings
          </span>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : view === 'pages' ? (
        /* ── Booking Pages Grid ── */
        forms.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <CalendarClock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No booking pages</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create a meeting booking form to start accepting appointments
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <div
                key={form.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-gray-900 dark:text-white truncate cursor-pointer hover:text-purple-600"
                      onClick={() => navigate(`/forms/${form.id}/builder`)}
                    >
                      {form.name}
                    </h3>
                    {form.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {form.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {form.meetingConfig?.durationMinutes || 30} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {form.confirmedCount} booked
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      form.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {form.status}
                  </span>
                </div>

                {form.status === 'active' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.open(getPublicUrl(form), '_blank')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      onClick={() => copyLink(form)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </button>
                    <button
                      onClick={() => navigate(`/forms/${form.id}/builder`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Bookings Table ── */
        bookings.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <CalendarClock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No bookings yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Bookings will appear here once invitees schedule meetings
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Invitee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Form
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {b.inviteeName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {b.inviteeEmail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {formatDateTime(b.startTime)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {b.formName || '—'}
                      </td>
                      <td className="px-4 py-3">{statusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => loadBookings(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      p === meta.page
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
