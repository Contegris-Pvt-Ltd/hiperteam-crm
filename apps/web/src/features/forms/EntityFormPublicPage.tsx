import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { api } from '../../api/contacts.api';
import type { FormField } from '../../api/forms.api';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export function EntityFormPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const tenant = searchParams.get('tenant');

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token || !tenant) {
      setError('Invalid form link');
      setLoading(false);
      return;
    }
    api.get(`/forms/public/form/${token}`, { params: { tenant } })
      .then((res) => {
        const data = res.data;
        setForm(data);
        // Pre-populate hidden field default values
        const fields: FormField[] = data.formFields || data.fields || [];
        const hiddenDefaults: Record<string, any> = {};
        fields.forEach((f: any) => {
          if (f.visibility === 'hidden' && f.defaultValue) {
            hiddenDefaults[f.name || f.key || f.id] = f.defaultValue;
          }
        });
        if (Object.keys(hiddenDefaults).length) {
          setValues((prev) => ({ ...hiddenDefaults, ...prev }));
        }
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.response?.data?.message || 'Form not found or link expired');
        setLoading(false);
      });
  }, [token, tenant]);

  // Load reCAPTCHA v3 script once when captcha is required
  useEffect(() => {
    if (!form?.settings?.requireCaptcha || !RECAPTCHA_SITE_KEY) return;
    if (document.getElementById('recaptcha-script')) return;

    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, [form]);

  const getRecaptchaToken = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const grecaptcha = (window as any).grecaptcha;
      if (!grecaptcha?.ready) return reject(new Error('reCAPTCHA not loaded'));
      grecaptcha.ready(() => {
        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' })
          .then(resolve)
          .catch(reject);
      });
    });

  const validate = (): boolean => {
    const fields: FormField[] = form?.formFields || form?.fields || [];
    const errors: Record<string, string> = {};
    for (const field of fields) {
      // Skip hidden fields for validation
      if ((field as any).visibility === 'hidden' || (field as any).hidden) continue;
      const key = field.name;
      if (field.required && !values[key]) {
        errors[key] = `${field.label} is required`;
      }
      if (field.type === 'email' && values[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[key])) {
        errors[key] = 'Invalid email address';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !token || !tenant) return;

    setSubmitting(true);
    setError('');
    try {
      let captchaToken: string | undefined;
      if (form?.settings?.requireCaptcha && RECAPTCHA_SITE_KEY) {
        captchaToken = await getRecaptchaToken();
      }
      await api.post(`/forms/public/submit/${token}`, {
        data: { ...values, captchaToken },
        tenant,
      }, { params: { tenant } });
      if (form?.settings?.redirectUrl) {
        window.location.href = form.settings.redirectUrl;
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = form?.branding?.primaryColor || '#7c3aed';
  const bgColor = form?.branding?.backgroundColor || '#f3f4f6';
  const fields: FormField[] = form?.formFields || form?.fields || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: primaryColor }} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600">
            {form?.settings?.successMessage || 'Your submission has been received.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: bgColor }}>
      <div className="max-w-2xl mx-auto">
        {/* Branding Header */}
        {(form?.branding?.logoUrl || form?.branding?.headerText) && (
          <div className="text-center mb-6">
            {form.branding.logoUrl && (
              <img src={form.branding.logoUrl} alt="" className="h-12 mx-auto mb-3 object-contain" />
            )}
            {form.branding.headerText && (
              <p className="text-sm text-gray-600">{form.branding.headerText}</p>
            )}
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Title */}
          <div className="px-8 pt-8 pb-4" style={{ borderTop: `4px solid ${primaryColor}` }}>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{form?.formName || form?.name || 'Form'}</h1>
            {form?.description && <p className="text-gray-500 mt-1">{form.description}</p>}
          </div>

          {/* Entity Context Banner */}
          {form?.entityName && (
            <div className="mx-8 mb-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                This form is for: <span className="font-medium">{form.entityName}</span>
              </p>
            </div>
          )}

          {/* Fields */}
          <form onSubmit={handleSubmit} className="px-8 pb-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {fields.map((field: any) => {
                // Skip hidden fields — their defaults are already in values
                if (field.visibility === 'hidden' || field.hidden) return null;

                return (
                  <PublicField
                    key={field.id}
                    field={field}
                    value={values[field.name]}
                    error={fieldErrors[field.name]}
                    onChange={(val) => setValues((prev) => ({ ...prev, [field.name]: val }))}
                    primaryColor={primaryColor}
                  />
                );
              })}
            </div>

            {form?.settings?.requireCaptcha && (
              <p className="pt-2 text-xs text-gray-400">
                This form is protected by reCAPTCHA.
              </p>
            )}

            {/* Notes / Terms & Conditions */}
            {form?.settings?.notes && (
              <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{form.settings.notes}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full py-3 rounded-xl text-white font-medium text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

        {/* Footer */}
        {form?.branding?.footerText ? (
          <p className="text-center text-xs text-gray-400 mt-4">{form.branding.footerText}</p>
        ) : (
          <p className="text-center text-xs text-gray-400 mt-4">Powered by IntelliSales CRM</p>
        )}
      </div>
    </div>
  );
}

function PublicField({
  field,
  value,
  error,
  onChange,
  primaryColor,
}: {
  field: FormField;
  value: any;
  error?: string;
  onChange: (val: any) => void;
  primaryColor: string;
}) {
  if (field.type === 'heading') {
    return <h3 className="text-lg font-semibold text-gray-900 pt-2">{field.label}</h3>;
  }
  if (field.type === 'paragraph') {
    return <p className="text-sm text-gray-600">{field.label}</p>;
  }
  if (field.type === 'divider') {
    return <hr className="border-gray-200" />;
  }

  const inputClass = `w-full px-4 py-2.5 border rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 ${
    error
      ? 'border-red-300 focus:ring-red-200'
      : 'border-gray-200 focus:ring-purple-200'
  }`;

  return (
    <div className={field.width === 'half' ? 'inline-block w-[48%] mr-[4%] align-top' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={inputClass}
        />
      ) : field.type === 'select' ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{field.placeholder || 'Select...'}</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.type === 'radio' ? (
        <div className="space-y-2 mt-1">
          {(field.options || []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                style={{ accentColor: primaryColor }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : field.type === 'checkbox' ? (
        <div className="space-y-2 mt-1">
          {(field.options || []).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={(value || []).includes(opt.value)}
                onChange={(e) => {
                  const arr = value || [];
                  onChange(
                    e.target.checked
                      ? [...arr, opt.value]
                      : arr.filter((v: string) => v !== opt.value),
                  );
                }}
                style={{ accentColor: primaryColor }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
