import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { accountsApi } from '../../api/accounts.api';
import type { Account } from '../../api/accounts.api';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAccount();
  }, [id]);

  const fetchAccount = async () => {
    if (!id) return;
    try {
      const data = await accountsApi.getOne(id);
      setAccount(data);
    } catch {
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !account) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <Link to="/accounts" className="inline-flex items-center gap-2 text-sm text-gray-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Accounts
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {account.logoUrl ? (
            <img src={account.logoUrl} alt={account.name} className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
              {account.name[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{account.name}</h1>
            {account.industry && <p className="text-gray-500 dark:text-slate-400">{account.industry}</p>}
            {account.website && (
              <a href={account.website} target="_blank" className="text-blue-600 hover:underline text-sm">{account.website}</a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/accounts/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Account Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-900 dark:text-white">{account.accountType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contacts</span>
                <span className="text-gray-900 dark:text-white">{account.contactsCount}</span>
              </div>
              {account.companySize && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Size</span>
                  <span className="text-gray-900 dark:text-white">{account.companySize}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Description</h3>
            <p className="text-gray-600 dark:text-slate-300">{account.description || 'No description'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}