import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormLandingPageConfig } from '../../api/forms.api';
import { FormPublicPage } from './FormPublicPage';

export function LandingPagePublicPage() {
  const { tenantSlug, token } = useParams<{ tenantSlug: string; token: string }>();
  const [config, setConfig] = useState<FormLandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantSlug || !token) return;
    formsApi.getPublicForm(tenantSlug, token)
      .then((f) => {
        setConfig(f.landingPageConfig || {});
        setLoading(false);
      })
      .catch(() => { setError('Page not found or no longer active'); setLoading(false); });
  }, [tenantSlug, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">{error || 'Page not found'}</p>
        </div>
      </div>
    );
  }

  const heroBg = config.heroBgColor || '#7c3aed';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SEO meta tags */}
      {config.seoTitle && <title>{config.seoTitle}</title>}

      {/* Hero section */}
      {(config.heroTitle || config.heroSubtitle || config.heroImageUrl) && (
        <div
          className="relative py-20 px-4 text-center text-white"
          style={{ backgroundColor: heroBg }}
        >
          {config.heroImageUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${config.heroImageUrl})` }}
            />
          )}
          <div className="relative z-10 max-w-3xl mx-auto">
            {config.heroTitle && (
              <h1 className="text-4xl font-bold mb-4">{config.heroTitle}</h1>
            )}
            {config.heroSubtitle && (
              <p className="text-xl opacity-90">{config.heroSubtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* Extra sections (text / image / cta) */}
      {(config.sections || []).map((section) => (
        <div key={section.id} className="max-w-3xl mx-auto px-4 py-10">
          {section.type === 'text' && section.content && (
            <div
              className="prose prose-lg max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          )}
          {section.type === 'image' && section.imageUrl && (
            <img src={section.imageUrl} alt="" className="w-full rounded-2xl shadow-md" />
          )}
          {section.type === 'cta' && section.ctaText && (
            <div className="text-center">
              <a
                href={section.ctaUrl || '#form'}
                className="inline-flex items-center px-8 py-3 rounded-xl text-white font-semibold shadow-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: heroBg }}
              >
                {section.ctaText}
              </a>
            </div>
          )}
        </div>
      ))}

      {/* The form itself — FormPublicPage reads tenantSlug/token from URL params */}
      <div id="form">
        <FormPublicPage />
      </div>

      {/* Custom CSS */}
      {config.customCss && <style>{config.customCss}</style>}
    </div>
  );
}
