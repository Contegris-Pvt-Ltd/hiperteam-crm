import { useState } from 'react';
import { X, Code2, Copy, Check } from 'lucide-react';
import type { FormRecord } from '../../api/forms.api';

type EmbedTab = 'iframe' | 'script' | 'popup';

export function EmbedModal({ form, onClose }: { form: FormRecord; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<EmbedTab>('iframe');
  const [copied, setCopied] = useState<string | null>(null);

  const publicUrl = `${window.location.origin}/f/${form.tenantSlug}/${form.token}`;

  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;" title="${form.name}"></iframe>`;

  const scriptCode = `<div id="intellicon-form-${form.id}"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${publicUrl}';
    iframe.style = 'width:100%;height:600px;border:none;border-radius:8px;';
    iframe.title = '${form.name}';
    document.getElementById('intellicon-form-${form.id}').appendChild(iframe);
  })();
<\/script>`;

  const popupCode = `<!-- Trigger Button -->
<button onclick="document.getElementById('icn-popup-${form.id}').style.display='flex'"
  style="padding:12px 24px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">
  Open Form
</button>

<!-- Popup Overlay -->
<div id="icn-popup-${form.id}"
  onclick="if(event.target===this)this.style.display='none'"
  style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
  <div style="position:relative;width:90%;max-width:720px;background:#fff;border-radius:12px;overflow:hidden;">
    <button onclick="document.getElementById('icn-popup-${form.id}').style.display='none'"
      style="position:absolute;top:12px;right:12px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;width:28px;height:28px;font-size:16px;cursor:pointer;z-index:1;">&#x2715;</button>
    <iframe src="${publicUrl}" width="100%" height="600"
      frameborder="0" style="border:none;display:block;" title="${form.name}"></iframe>
  </div>
</div>`;

  const tabCodes: Record<EmbedTab, string> = {
    iframe: iframeCode,
    script: scriptCode,
    popup: popupCode,
  };

  const copy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const tabs: { key: EmbedTab; label: string }[] = [
    { key: 'iframe', label: 'iFrame' },
    { key: 'script', label: 'JavaScript' },
    { key: 'popup', label: 'Popup' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <Code2 className="w-5 h-5 text-purple-600" />
            Embed Form
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Direct Link */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Direct Link</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 font-mono"
              />
              <button
                onClick={() => copy(publicUrl, 'link')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors whitespace-nowrap"
              >
                {copied === 'link' ? (
                  <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600">Copied!</span></>
                ) : (
                  <><Copy className="w-3.5 h-3.5" />Copy</>
                )}
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="border-b border-gray-200 dark:border-slate-700">
            <div className="flex gap-1">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === key
                      ? 'text-purple-600 border-purple-600'
                      : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Code Block */}
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed min-h-[120px]">
              {tabCodes[activeTab]}
            </pre>
            <button
              onClick={() => copy(tabCodes[activeTab], activeTab)}
              className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                copied === activeTab
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-gray-200'
              }`}
            >
              {copied === activeTab ? (
                <><Check className="w-3 h-3" />Copied!</>
              ) : (
                <><Copy className="w-3 h-3" />Copy Code</>
              )}
            </button>
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Paste this code into any HTML page or WordPress / Webflow site.
          </p>
        </div>
      </div>
    </div>
  );
}
