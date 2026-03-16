import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalendarX2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { schedulingApi } from '../../api/scheduling.api';

export function BookingCancelPage() {
  const { cancelToken } = useParams<{ cancelToken: string }>();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || '';

  const [status, setStatus] = useState<'confirm' | 'cancelling' | 'done' | 'error'>('confirm');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!cancelToken || !tenantSlug) {
      setError('Invalid cancellation link.');
      setStatus('error');
      return;
    }

    setStatus('cancelling');
    try {
      await schedulingApi.cancelBooking(cancelToken, tenantSlug, reason || undefined);
      setStatus('done');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to cancel booking. It may have already been cancelled.');
      setStatus('error');
    }
  };

  if (!cancelToken || !tenantSlug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500">This cancellation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {status === 'confirm' && (
          <div className="text-center">
            <CalendarX2 className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Cancel Booking</h1>
            <p className="text-gray-500 mb-6">Are you sure you want to cancel this booking?</p>

            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Let us know why you're cancelling..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.close()}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        )}

        {status === 'cancelling' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto mb-4" />
            <p className="text-gray-500">Cancelling your booking...</p>
          </div>
        )}

        {status === 'done' && (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Booking Cancelled</h1>
            <p className="text-gray-500">
              Your booking has been successfully cancelled. A confirmation email has been sent.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Cancel</h1>
            <p className="text-gray-500">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
