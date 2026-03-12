import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormField } from '../../api/forms.api';

export function FormPublicPage() {
  const { tenantSlug, token } = useParams<{ tenantSlug: string; token: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tenantSlug || !token) return;
    formsApi.getPublicForm(tenantSlug, token)
      .then((f) => { setForm(f); setLoading(false); })
      .catch(() => { setError('Form not found or no longer active'); setLoading(false); });
  }, [tenantSlug, token]);

  const renderCaptcha = (siteKey: string) => {
    if (!captchaRef.current) return;
    if (captchaRef.current.childElementCount > 0) return;
    (window as any).grecaptcha?.render(captchaRef.current, {
      sitekey: siteKey,
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(null),
    });
  };

  useEffect(() => {
    if (!form?.settings?.requireCaptcha) return;

    const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

    if (document.getElementById('recaptcha-script')) {
      renderCaptcha(SITE_KEY);
      return;
    }

    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=onRecaptchaLoad';
    script.async = true;
    script.defer = true;

    (window as any).onRecaptchaLoad = () => renderCaptcha(SITE_KEY);
    document.head.appendChild(script);
  }, [form]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    for (const field of (form?.fields || [])) {
      if (field.required && !values[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
      if (field.type === 'email' && values[field.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[field.name])) {
        errors[field.name] = 'Invalid email address';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !tenantSlug || !token) return;

    if (form?.settings?.requireCaptcha && !captchaToken) {
      setError('Please complete the CAPTCHA verification.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await formsApi.submitPublicForm(tenantSlug, token, values);
      if (form?.settings?.redirectUrl) {
        window.location.href = form.settings.redirectUrl;
        return;
      }
      setSubmitted(true);
      setCaptchaToken(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = form?.branding?.primaryColor || '#7c3aed';
  const bgColor = form?.branding?.backgroundColor || '#f3f4f6';

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
        {(form.branding?.logoUrl || form.branding?.headerText) && (
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
            <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
            {form.description && <p className="text-gray-500 mt-1">{form.description}</p>}
          </div>

          {/* Fields */}
          <form onSubmit={handleSubmit} className="px-8 pb-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {(form.fields || []).map((field: FormField) => (
                <PublicField
                  key={field.id}
                  field={field}
                  value={values[field.name]}
                  error={fieldErrors[field.name]}
                  onChange={(val) => setValues((prev) => ({ ...prev, [field.name]: val }))}
                  primaryColor={primaryColor}
                />
              ))}
            </div>

            {form.settings?.requireCaptcha && (
              <div className="pt-2">
                <div ref={captchaRef} />
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
        {form.branding?.footerText && (
          <p className="text-center text-xs text-gray-400 mt-4">{form.branding.footerText}</p>
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
