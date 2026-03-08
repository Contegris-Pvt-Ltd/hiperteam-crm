import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '../../api/contacts.api';

export function XeroCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to Xero...');
  const navigate = useNavigate();

  useEffect(() => {
    const fullUrl = window.location.href;

    api.get('/admin/xero/callback', { params: { url: fullUrl } })
      .then(() => {
        setStatus('success');
        setMessage('Xero connected successfully!');
        setTimeout(() => navigate('/admin/integrations'), 2500);
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Failed to connect Xero.');
      });
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Connecting to Xero</h2>
            <p className="text-gray-500 dark:text-slate-400">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Xero Connected!</h2>
            <p className="text-gray-500 dark:text-slate-400">Redirecting to integrations...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Connection Failed</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-6">{message}</p>
            <button
              onClick={() => navigate('/admin/integrations')}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
            >
              Back to Integrations
            </button>
          </>
        )}
      </div>
    </div>
  );
}
