import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { api } from '../../api/contacts.api';

export function EntityFormPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant');

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token || !tenant) {
      setError('Invalid form link');
      setLoading(false);
      return;
    }
    // Fetch form details via public endpoint
    api.get(`/forms/public/form/${token}`, { params: { tenant } })
      .then(res => {
        setForm(res.data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.response?.data?.message || 'Form not found or link expired');
        setLoading(false);
      });
  }, [token, tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tenant) return;
    setSubmitting(true);
    try {
      await api.post(`/forms/public/submit/${token}`, { data: values, email, tenant });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit form');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Form</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600">Your form has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  const fields = form?.formFields || form?.fields || [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-purple-600 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <h1 className="text-xl font-semibold">{form?.formName || 'Form'}</h1>
            </div>
            {form?.description && (
              <p className="text-purple-100 mt-1 text-sm">{form.description}</p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Email field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="your@email.com"
              />
            </div>

            {/* Dynamic fields */}
            {fields.map((field: any) => {
              if (field.type === 'heading') {
                return <h3 key={field.id} className="text-lg font-semibold text-gray-900 pt-2">{field.label}</h3>;
              }
              if (field.type === 'paragraph') {
                return <p key={field.id} className="text-sm text-gray-600">{field.label}</p>;
              }
              if (field.type === 'divider') {
                return <hr key={field.id} className="border-gray-200" />;
              }

              const fieldKey = field.key || field.id;
              return (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {(field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'number' || field.type === 'date') && (
                    <input
                      type={field.type === 'phone' ? 'tel' : field.type}
                      required={field.required}
                      value={values[fieldKey] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      required={field.required}
                      value={values[fieldKey] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                      placeholder={field.placeholder || ''}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      required={field.required}
                      value={values[fieldKey] || ''}
                      onChange={e => setValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map((opt: any) => (
                        <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
                      ))}
                    </select>
                  )}
                  {field.type === 'radio' && (
                    <div className="space-y-2">
                      {(field.options || []).map((opt: any) => (
                        <label key={opt.value || opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={fieldKey}
                            value={opt.value || opt}
                            checked={values[fieldKey] === (opt.value || opt)}
                            onChange={e => setValues(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                            className="accent-purple-600"
                          />
                          <span className="text-sm text-gray-700">{opt.label || opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!values[fieldKey]}
                        onChange={e => setValues(prev => ({ ...prev, [fieldKey]: e.target.checked }))}
                        className="accent-purple-600"
                      />
                      <span className="text-sm text-gray-700">{field.placeholder || field.label}</span>
                    </label>
                  )}
                  {field.helpText && (
                    <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                  )}
                </div>
              );
            })}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by IntelliSales CRM
        </p>
      </div>
    </div>
  );
}
