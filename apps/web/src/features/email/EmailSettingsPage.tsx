import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Trash2,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  Server,
  CheckCircle,
  XCircle,
  Save,
  Image,
  Link2,
} from 'lucide-react';
import { emailApi } from '../../api/email.api';
import { usersApi } from '../../api/users.api';
import type { EmailAccount } from '../../api/email.api';

const providerIcons: Record<string, string> = {
  gmail: '📧',
  microsoft: '📬',
  imap: '🖥️',
};

const providerLabels: Record<string, string> = {
  gmail: 'Gmail',
  microsoft: 'Microsoft 365',
  imap: 'IMAP/SMTP',
};

export function EmailSettingsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImapForm, setShowImapForm] = useState(false);
  const [imapForm, setImapForm] = useState({
    email: '',
    displayName: '',
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: true,
    password: '',
    isShared: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await emailApi.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Disconnect this email account? All synced emails will be removed.')) return;
    try {
      await emailApi.deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestImap = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await emailApi.testImap({
        email: imapForm.email,
        imapHost: imapForm.imapHost,
        imapPort: imapForm.imapPort,
        imapSecure: imapForm.imapSecure,
        password: imapForm.password,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveImap = async () => {
    setSaving(true);
    try {
      await emailApi.connectImap(imapForm);
      setShowImapForm(false);
      setImapForm({
        email: '', displayName: '', imapHost: '', imapPort: 993, imapSecure: true,
        smtpHost: '', smtpPort: 587, smtpSecure: true, password: '', isShared: false,
      });
      loadAccounts();
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGmail = async (isShared = false) => {
    try {
      const { url } = await emailApi.getGmailOAuthUrl(isShared);
      window.location.href = url;
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Failed to connect Gmail' });
    }
  };

  const handleConnectMicrosoft = async (isShared = false) => {
    try {
      const { url } = await emailApi.getMicrosoftOAuthUrl(isShared);
      window.location.href = url;
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Failed to connect Microsoft' });
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      await emailApi.syncAccount(id);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/inbox')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Email Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage connected email accounts</p>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="space-y-3 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Connected Accounts
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
            <Mail className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No accounts connected yet</p>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{providerIcons[account.provider]}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{account.email}</span>
                    {account.isShared && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full">
                        <Users className="w-3 h-3" /> Shared
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{providerLabels[account.provider]}</span>
                    {account.lastSyncedAt && (
                      <span>Last synced: {new Date(account.lastSyncedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(account.id)}
                  disabled={syncing === account.id}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                  title="Sync now"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing === account.id ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  title="Disconnect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Connect New Account */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Connect New Account
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Gmail */}
          <button
            onClick={() => handleConnectGmail(false)}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow text-center cursor-pointer block w-full"
          >
            <span className="text-3xl block mb-2">📧</span>
            <p className="font-medium text-gray-900 dark:text-white text-sm">Gmail</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Connect with Google OAuth</p>
          </button>

          {/* Microsoft */}
          <button
            onClick={() => handleConnectMicrosoft(false)}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow text-center cursor-pointer block w-full"
          >
            <span className="text-3xl block mb-2">📬</span>
            <p className="font-medium text-gray-900 dark:text-white text-sm">Microsoft 365</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Connect with Microsoft OAuth</p>
          </button>

          {/* IMAP */}
          <button
            onClick={() => setShowImapForm(!showImapForm)}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow text-center"
          >
            <span className="text-3xl block mb-2">🖥️</span>
            <p className="font-medium text-gray-900 dark:text-white text-sm">IMAP / SMTP</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manual server configuration</p>
          </button>
        </div>

        {/* IMAP Form */}
        {showImapForm && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mt-4 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4" /> IMAP/SMTP Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email Address</label>
                <input
                  value={imapForm.email}
                  onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Display Name</label>
                <input
                  value={imapForm.displayName}
                  onChange={(e) => setImapForm({ ...imapForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">IMAP (Incoming)</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <input
                    value={imapForm.imapHost}
                    onChange={(e) => setImapForm({ ...imapForm, imapHost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                    placeholder="imap.company.com"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={imapForm.imapPort}
                    onChange={(e) => setImapForm({ ...imapForm, imapPort: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={imapForm.imapSecure}
                  onChange={(e) => setImapForm({ ...imapForm, imapSecure: e.target.checked })}
                  className="rounded"
                />
                Use SSL/TLS
              </label>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">SMTP (Outgoing)</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <input
                    value={imapForm.smtpHost}
                    onChange={(e) => setImapForm({ ...imapForm, smtpHost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                    placeholder="smtp.company.com"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={imapForm.smtpPort}
                    onChange={(e) => setImapForm({ ...imapForm, smtpPort: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={imapForm.smtpSecure}
                  onChange={(e) => setImapForm({ ...imapForm, smtpSecure: e.target.checked })}
                  className="rounded"
                />
                Use STARTTLS
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={imapForm.password}
                onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                placeholder="App-specific password"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={imapForm.isShared}
                onChange={(e) => setImapForm({ ...imapForm, isShared: e.target.checked })}
                className="rounded"
              />
              <Shield className="w-4 h-4 text-gray-400" />
              Shared account (visible to all team members)
            </label>

            {testResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
                {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testResult.message}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTestImap}
                disabled={testing || !imapForm.email || !imapForm.imapHost}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                Test Connection
              </button>
              <button
                onClick={handleSaveImap}
                disabled={saving || !imapForm.email || !imapForm.imapHost || !imapForm.smtpHost || !imapForm.password}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                Save Account
              </button>
              <button
                onClick={() => setShowImapForm(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email Signature */}
      <SignatureEditor />
    </div>
  );
}

// ── Signature Editor Component ──────────────────────────────────
function SignatureEditor() {
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    usersApi.getEmailSignature().then((res) => {
      setSignature(res.signature);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Set content once loaded
  useEffect(() => {
    if (!loading && editorRef.current && signature) {
      editorRef.current.innerHTML = signature;
    }
  }, [loading]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const html = editorRef.current?.innerHTML || '';
      await usersApi.updateEmailSignature(html);
      setSignature(html);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save signature', err);
    } finally {
      setSaving(false);
    }
  };

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          document.execCommand('insertImage', false, dataUrl);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, []);

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        editorRef.current?.focus();
        document.execCommand('insertImage', false, evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (loading) return null;

  return (
    <div className="space-y-3 mt-8">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
        Email Signature
      </h2>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <button onMouseDown={preventFocusLoss} onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Bold">
            <span className="text-xs font-bold">B</span>
          </button>
          <button onMouseDown={preventFocusLoss} onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Italic">
            <span className="text-xs italic">I</span>
          </button>
          <button onMouseDown={preventFocusLoss} onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Underline">
            <span className="text-xs underline">U</span>
          </button>
          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />
          <button onMouseDown={preventFocusLoss} onClick={() => { const url = prompt('Enter link URL:'); if (url) execCmd('createLink', url); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Insert link">
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <button onMouseDown={preventFocusLoss} onClick={handleInsertImage} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Insert image">
            <Image className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />
          <select
            onMouseDown={preventFocusLoss}
            onChange={(e) => { if (e.target.value) execCmd('fontSize', e.target.value); }}
            className="text-xs bg-transparent border border-gray-200 dark:border-slate-600 rounded px-1 py-1 text-gray-500 dark:text-gray-400"
            defaultValue=""
          >
            <option value="" disabled>Size</option>
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
          </select>
          <input
            type="color"
            onMouseDown={preventFocusLoss}
            onChange={(e) => execCmd('foreColor', e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
            title="Text color"
            defaultValue="#000000"
          />
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          onPaste={handlePaste}
          className="min-h-[160px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none"
          suppressContentEditableWarning
          data-placeholder="Create your email signature..."
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Supports rich text, links, and pasted images. This signature will be appended to your composed emails.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved' : 'Save Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}
