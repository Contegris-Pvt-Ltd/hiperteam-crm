// ============================================================
// FILE: apps/web/src/features/scheduling/PublicBookingPage.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, Clock, MapPin, Video, Phone } from 'lucide-react';
import { schedulingApi } from '../../api/scheduling.api';
import type { FormField } from '../../api/forms.api';

type Step = 'calendar' | 'slots' | 'details' | 'confirmed';

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function PublicBookingPage() {
  const { tenantSlug, token } = useParams<{ tenantSlug: string; token: string }>();
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('calendar');

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');

  const [details, setDetails] = useState({
    inviteeName: '', inviteeEmail: '', inviteePhone: '', inviteeNotes: '',
  });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantSlug || !token) return;
    schedulingApi.getPublicForm(tenantSlug, token)
      .then((f) => { setPageData(f); setLoading(false); })
      .catch(() => { setError('Booking page not found or no longer active'); setLoading(false); });
  }, [tenantSlug, token]);

  useEffect(() => {
    if (!tenantSlug || !token || !pageData) return;
    setLoadingDates(true);
    schedulingApi.getPublicDates(tenantSlug, token, calYear, calMonth)
      .then((res) => setAvailableDates(res.availableDates))
      .catch(() => setAvailableDates([]))
      .finally(() => setLoadingDates(false));
  }, [tenantSlug, token, calYear, calMonth, pageData]);

  useEffect(() => {
    if (!tenantSlug || !token || !selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    schedulingApi.getPublicSlots(tenantSlug, token, selectedDate)
      .then((res) => setSlots(res.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot('');
    setStep('slots');
  };

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setStep('details');
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!details.inviteeName.trim()) errors.name = 'Name is required';
    if (!details.inviteeEmail.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.inviteeEmail)) errors.email = 'Invalid email';

    const customFields: FormField[] = pageData?.fields?.filter(
      (f: FormField) => !['heading', 'paragraph', 'divider'].includes(f.type)
    ) || [];
    for (const field of customFields) {
      if (field.required && !answers[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
    }

    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setSubmitting(true);

    try {
      await schedulingApi.createPublicBooking(tenantSlug!, token!, {
        startTime: selectedSlot,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        inviteeName: details.inviteeName,
        inviteeEmail: details.inviteeEmail,
        inviteePhone: details.inviteePhone || undefined,
        inviteeNotes: details.inviteeNotes || undefined,
        answers,
      });

      const cfg = pageData?.meetingConfig || {};
      if (cfg.redirectUrl) {
        window.location.href = cfg.redirectUrl;
      } else {
        setStep('confirmed');
      }
    } catch (err: any) {
      setFieldErrors({ _form: err?.response?.data?.message || 'Booking failed. The slot may no longer be available.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  );

  if (error || !pageData) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400">{error || 'Page not found'}</p>
      </div>
    </div>
  );

  const cfg = pageData.meetingConfig || {};
  const branding = pageData.branding || {};
  const primaryColor = branding.primaryColor || '#7c3aed';
  const customFields: FormField[] = (pageData.fields || []).filter(
    (f: FormField) => !['heading', 'paragraph', 'divider'].includes(f.type)
  );

  const locationIcon = cfg.locationType === 'video' ? <Video className="w-4 h-4" /> :
    cfg.locationType === 'phone' ? <Phone className="w-4 h-4" /> :
    <MapPin className="w-4 h-4" />;

  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mb-6">
          <div className="p-6" style={{ borderLeft: `4px solid ${primaryColor}` }}>
            <div className="flex items-start gap-4">
              {pageData.hostAvatar ? (
                <img src={pageData.hostAvatar} className="w-12 h-12 rounded-full object-cover" alt={pageData.hostName} />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg" style={{ backgroundColor: primaryColor }}>
                  {(pageData.hostName || 'H')[0]}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">{pageData.hostName}</p>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{pageData.name}</h1>
                {pageData.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pageData.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" /> {cfg.durationMinutes || 30} min
                  </span>
                  {cfg.locationValue && (
                    <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      {locationIcon}
                      {cfg.locationType === 'video' ? 'Video call' :
                       cfg.locationType === 'phone' ? 'Phone call' : cfg.locationValue}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar + Slots */}
        {(step === 'calendar' || step === 'slots') && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <h2 className="font-semibold text-gray-900 dark:text-white">{MONTH_NAMES[calMonth - 1]} {calYear}</h2>
              <button onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {loadingDates ? (
              <div className="flex items-center justify-center h-36"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calCells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const isAvailable = availableDates.includes(dateStr);
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button key={i} disabled={!isAvailable} onClick={() => handleDateSelect(dateStr)}
                      className={`aspect-square rounded-full text-sm font-medium transition-colors ${
                        isSelected ? 'text-white' : isAvailable ? 'text-gray-900 dark:text-white hover:text-white' : 'text-gray-300 dark:text-slate-600 cursor-not-allowed'
                      }`}
                      style={isSelected ? { backgroundColor: primaryColor } : {}}
                      onMouseEnter={(e) => { if (isAvailable && !isSelected) (e.target as HTMLElement).style.backgroundColor = primaryColor; (e.target as HTMLElement).style.color = '#fff'; }}
                      onMouseLeave={(e) => { if (isAvailable && !isSelected) { (e.target as HTMLElement).style.backgroundColor = ''; (e.target as HTMLElement).style.color = ''; } }}
                    >{day}</button>
                  );
                })}
              </div>
            )}

            {selectedDate && (
              <div className="mt-6 border-t border-gray-100 dark:border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                {loadingSlots ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No available slots on this day</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map((slot) => (
                      <button key={slot} onClick={() => handleSlotSelect(slot)}
                        className="px-4 py-2.5 text-sm font-medium border-2 rounded-xl transition-colors"
                        style={selectedSlot === slot
                          ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                          : { borderColor: primaryColor, color: primaryColor }
                        }
                      >
                        {new Date(slot).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Details */}
        {step === 'details' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <button onClick={() => setStep('calendar')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Your details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {new Date(selectedSlot).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' at '}{new Date(selectedSlot).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{cfg.durationMinutes || 30} min
            </p>
            {fieldErrors._form && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-400">{fieldErrors._form}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input value={details.inviteeName} onChange={(e) => setDetails({ ...details, inviteeName: e.target.value })} className={inputCls} placeholder="Jane Smith" />
                {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={details.inviteeEmail} onChange={(e) => setDetails({ ...details, inviteeEmail: e.target.value })} className={inputCls} placeholder="jane@example.com" />
                {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input type="tel" value={details.inviteePhone} onChange={(e) => setDetails({ ...details, inviteePhone: e.target.value })} className={inputCls} placeholder="+1 (555) 000-0000" />
              </div>
              {customFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea rows={3} value={answers[field.name] || ''} onChange={(e) => setAnswers({ ...answers, [field.name]: e.target.value })} placeholder={field.placeholder} className={`${inputCls} resize-none`} />
                  ) : field.type === 'select' ? (
                    <select value={answers[field.name] || ''} onChange={(e) => setAnswers({ ...answers, [field.name]: e.target.value })} className={inputCls}>
                      <option value="">Select...</option>
                      {(field.options || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : (
                    <input type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'} value={answers[field.name] || ''} onChange={(e) => setAnswers({ ...answers, [field.name]: e.target.value })} placeholder={field.placeholder} className={inputCls} />
                  )}
                  {fieldErrors[field.name] && <p className="text-xs text-red-500 mt-1">{fieldErrors[field.name]}</p>}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Additional notes (optional)</label>
                <textarea rows={3} value={details.inviteeNotes} onChange={(e) => setDetails({ ...details, inviteeNotes: e.target.value })} placeholder="Anything you'd like me to know?" className={`${inputCls} resize-none`} />
              </div>
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Booking
              </button>
            </div>
          </div>
        )}

        {/* Confirmed */}
        {step === 'confirmed' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primaryColor}20` }}>
              <CheckCircle className="w-8 h-8" style={{ color: primaryColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're confirmed!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-1">
              {new Date(selectedSlot).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {new Date(selectedSlot).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · {cfg.durationMinutes || 30} min with {pageData.hostName}
            </p>
            {cfg.confirmationMessage && <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{cfg.confirmationMessage}</p>}
            <p className="text-sm text-gray-400">A confirmation email has been sent to {details.inviteeEmail}</p>
          </div>
        )}
      </div>
    </div>
  );
}
