import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, FileText, Calendar, DollarSign } from 'lucide-react';
import { proposalsApi } from '../../api/proposals.api';
import type { Proposal } from '../../api/proposals.api';

export function ProposalPublicPage() {
  const { tenantId, token } = useParams<{ tenantId: string; token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<'accepting' | 'declining' | null>(null);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (!tenantId || !token) return;
    proposalsApi.getByToken(tenantId, token)
      .then(setProposal)
      .catch(() => setError('This proposal is not available or has expired.'))
      .finally(() => setLoading(false));
  }, [tenantId, token]);

  const handleAccept = async () => {
    if (!tenantId || !token) return;
    setActing('accepting');
    try {
      await proposalsApi.accept(tenantId, token);
      setDone('accepted');
      setProposal(p => p ? { ...p, status: 'accepted' } : p);
    } catch {
      setError('Could not accept proposal. It may have already been responded to.');
    } finally {
      setActing(null);
    }
  };

  const handleDecline = async () => {
    if (!tenantId || !token) return;
    setActing('declining');
    try {
      await proposalsApi.decline(tenantId, token);
      setDone('declined');
      setProposal(p => p ? { ...p, status: 'declined' } : p);
    } catch {
      setError('Could not decline proposal.');
    } finally {
      setActing(null);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  );

  // ── Error ──
  if (error || !proposal) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Proposal Not Found</h1>
        <p className="text-gray-500">{error || 'This proposal link is invalid or expired.'}</p>
      </div>
    </div>
  );

  // ── Done state ──
  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {done === 'accepted'
          ? <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          : <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        }
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {done === 'accepted' ? 'Proposal Accepted' : 'Proposal Declined'}
        </h1>
        <p className="text-gray-500">
          {done === 'accepted'
            ? 'Thank you! We will be in touch shortly.'
            : 'Thank you for letting us know.'}
        </p>
      </div>
    </div>
  );

  const canAct = proposal.status === 'published' || proposal.status === 'sent' || proposal.status === 'viewed';

  // ── Main view ──
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">Proposal</p>
              <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium shrink-0 ${
              proposal.status === 'accepted' ? 'bg-green-100 text-green-700' :
              proposal.status === 'declined' ? 'bg-red-100 text-red-700' :
              proposal.status === 'expired'  ? 'bg-amber-100 text-amber-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-6 text-sm text-gray-500">
            {proposal.validUntil && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Valid until {new Date(proposal.validUntil).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              Total: {proposal.currency} {proposal.totalAmount.toLocaleString()}
            </div>
          </div>

          {/* Cover message */}
          {proposal.coverMessage && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.coverMessage}</p>
            </div>
          )}
        </div>

        {/* Line items */}
        {proposal.lineItems && proposal.lineItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                Line Items
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proposal.lineItems.map((item, i) => (
                  <tr key={item.id || i}>
                    <td className="px-6 py-3 text-gray-900">{item.description}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {proposal.currency} {item.unitPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {item.discount
                        ? item.discountType === 'fixed'
                          ? `${proposal.currency} ${item.discount}`
                          : `${item.discount}%`
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {proposal.currency} {(item.total ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-6 py-3 text-right font-semibold text-gray-700">Total</td>
                  <td className="px-6 py-3 text-right font-bold text-gray-900">
                    {proposal.currency} {proposal.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Terms */}
        {proposal.terms && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.terms}</p>
          </div>
        )}

        {/* Action buttons */}
        {canAct && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-500 mb-4 text-center">
              Please review the proposal above and let us know your decision.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleDecline}
                disabled={!!acting}
                className="flex items-center gap-2 px-6 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium disabled:opacity-50">
                {acting === 'declining'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <XCircle className="w-4 h-4" />}
                Decline
              </button>
              <button
                onClick={handleAccept}
                disabled={!!acting}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {acting === 'accepting'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle className="w-4 h-4" />}
                Accept Proposal
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
