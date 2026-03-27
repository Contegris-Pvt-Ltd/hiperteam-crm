import { useState, useCallback, useEffect } from 'react';
import { X, Loader2, FileText, Save } from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormField } from '../../api/forms.api';

interface FormFillModalProps {
  form: { id: string; name: string; fields: FormField[]; settings?: any };
  entityType: string;
  entityId: string;
  existingData?: Record<string, any>;
  readOnly?: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function FormFillModal({
  form,
  entityType,
  entityId,
  existingData,
  readOnly = false,
  onClose,
  onSubmitted,
}: FormFillModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>(existingData || {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate hidden field default values on mount
  useEffect(() => {
    const hiddenDefaults: Record<string, any> = {};
    form.fields.forEach((f: any) => {
      if (f.visibility === 'hidden' && f.defaultValue) {
        hiddenDefaults[f.name] = f.defaultValue;
      }
    });
    if (Object.keys(hiddenDefaults).length) {
      setFormData((prev) => ({ ...hiddenDefaults, ...prev }));
    }
  }, [form.fields]);

  const handleChange = useCallback((fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handleSubmit = async () => {
    // Validate required fields
    const missing = form.fields.filter(
      (f) => f.required && !['heading', 'paragraph', 'divider'].includes(f.type) && (f as any).visibility !== 'hidden' && !formData[f.name],
    );
    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await formsApi.submitEntityForm({
        formId: form.id,
        entityType,
        entityId,
        data: formData,
      });
      onSubmitted();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    // Skip hidden fields — their defaults are already in formData
    if ((field as any).visibility === 'hidden') return null;

    const value = formData[field.name] ?? '';
    const baseInputClass =
      'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent';
    const readOnlyClass =
      'w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 rounded-lg text-sm text-gray-900 dark:text-white';

    if (field.type === 'heading') {
      return (
        <h3 key={field.id} className="text-lg font-semibold text-gray-900 dark:text-white pt-2">
          {field.label}
        </h3>
      );
    }

    if (field.type === 'paragraph') {
      return (
        <p key={field.id} className="text-sm text-gray-600 dark:text-slate-400">
          {field.label}
        </p>
      );
    }

    if (field.type === 'divider') {
      return <hr key={field.id} className="border-gray-200 dark:border-slate-700" />;
    }

    const label = (
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
    );

    if (readOnly) {
      let displayValue = value;
      if (field.type === 'checkbox') {
        displayValue = value ? 'Yes' : 'No';
      } else if (field.type === 'select' || field.type === 'radio') {
        const opt = field.options?.find((o) => o.value === value);
        displayValue = opt?.label || value;
      } else if (field.type === 'date' && value) {
        try {
          displayValue = new Date(value).toLocaleDateString();
        } catch {
          displayValue = value;
        }
      }
      return (
        <div key={field.id}>
          {label}
          <div className={readOnlyClass}>{displayValue || <span className="text-gray-400 italic">Not provided</span>}</div>
        </div>
      );
    }

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id}>
            {label}
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
            />
          </div>
        );
      case 'email':
        return (
          <div key={field.id}>
            {label}
            <input
              type="email"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
            />
          </div>
        );
      case 'phone':
        return (
          <div key={field.id}>
            {label}
            <input
              type="tel"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
            />
          </div>
        );
      case 'number':
        return (
          <div key={field.id}>
            {label}
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
            />
          </div>
        );
      case 'textarea':
        return (
          <div key={field.id}>
            {label}
            <textarea
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={baseInputClass}
            />
          </div>
        );
      case 'select':
        return (
          <div key={field.id}>
            {label}
            <select
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className={baseInputClass}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );
      case 'radio':
        return (
          <div key={field.id}>
            {label}
            <div className="space-y-2 mt-1">
              {field.options?.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    className="text-purple-600"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        );
      case 'checkbox':
        return (
          <div key={field.id}>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleChange(field.name, e.target.checked)}
                className="rounded text-purple-600"
              />
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>
          </div>
        );
      case 'date':
        return (
          <div key={field.id}>
            {label}
            <input
              type="date"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className={baseInputClass}
            />
          </div>
        );
      case 'file':
        return (
          <div key={field.id}>
            {label}
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder="File URL or reference"
              className={baseInputClass}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {readOnly ? 'View Submission' : 'Fill Form'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">{form.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {form.fields.map((field) => renderField(field))}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
