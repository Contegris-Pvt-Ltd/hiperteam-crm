import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, CheckCircle, XCircle, PenLine,
  FileText, Calendar, DollarSign, Users, AlertTriangle,
} from 'lucide-react';
import { contractsApi } from '../../api/contracts.api';
import { CompanyLetterhead } from '../../components/shared/CompanyLetterhead';
import type { Contract } from '../../api/contracts.api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent_for_signing: 'bg-blue-100 text-blue-700',
  partially_signed: 'bg-amber-100 text-amber-700',
  fully_signed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  terminated: 'bg-red-100 text-red-700',
  renewed: 'bg-purple-100 text-purple-700',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent_for_signing: 'Sent for Signing',
  partially_signed: 'Partially Signed',
  fully_signed: 'Fully Signed',
  expired: 'Expired',
  terminated: 'Terminated',
  renewed: 'Renewed',
};

const TYPE_LABELS: Record<string, string> = {
  nda: 'NDA',
  msa: 'MSA',
  sow: 'SOW',
  service_agreement: 'Service Agreement',
  custom: 'Custom',
};

const SIG_STATUS_ICON: Record<string, React.ReactNode> = {
  signed: <CheckCircle className="w-4 h-4 text-green-500" />,
  sent: <PenLine className="w-4 h-4 text-blue-500" />,
  pending: <Loader2 className="w-4 h-4 text-gray-400" />,
  declined: <XCircle className="w-4 h-4 text-red-500" />,
};

export function ContractSignPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'signed' | 'declined' | null>(null);
  const [acting, setActing] = useState<'signing' | 'declining' | null>(null);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Canvas for signature drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // ── Load contract ──
  useEffect(() => {
    if (!token) return;
    contractsApi.getByToken(token)
      .then(setContract)
      .catch(() => setError('This signing link is invalid or has already been used.'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Draw watermark on mount ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawWatermark(ctx, canvas);
  }, [contract, done, loading]);

  const drawWatermark = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sign here', canvas.width / 2, canvas.height / 2 + 6);
  };

  // ── Canvas helpers ──
  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as MouseEvent).clientX - rect.left,
      y: (e as MouseEvent).clientY - rect.top,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Prevent page scroll on mobile while drawing
    if ('touches' in e.nativeEvent) {
      e.preventDefault();
    }
    setIsDrawing(true);
    lastPosRef.current = getPos(e.nativeEvent as any, canvas);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Prevent page scroll on mobile while drawing
    if ('touches' in e.nativeEvent) {
      e.preventDefault();
    }
    const pos = getPos(e.nativeEvent as any, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPosRef.current = pos;
    setHasSignature(true);
  }, [isDrawing]);

  const stopDraw = useCallback(() => setIsDrawing(false), []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawWatermark(ctx, canvas);
    setHasSignature(false);
  };

  // ── Actions ──
  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature || !token) return;
    const signatureData = canvas.toDataURL('image/png');
    setActing('signing');
    try {
      await contractsApi.sign(token, signatureData);
      setDone('signed');
    } catch {
      setError('Failed to submit signature. Please try again.');
    } finally {
      setActing(null);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActing('declining');
    try {
      await contractsApi.decline(token, declineReason);
      setDone('declined');
    } catch {
      setError('Failed to decline. Please try again.');
    } finally {
      setActing(null);
    }
  };

  // ── Resolve current signatory ──
  const currentSignatory = contract?.signatories?.find(
    (s) => s.isCurrentUser === true
  ) || contract?.signatories?.find(
    (s) => s.status === 'sent'
  );

  const canAct =
    currentSignatory &&
    ['sent', 'pending'].includes(currentSignatory.status) &&
    contract &&
    ['sent_for_signing', 'partially_signed'].includes(contract.status);

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
    </div>
  );

  // ── Error ──
  if (error || !contract) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Contract Not Found</h1>
        <p className="text-gray-500">{error || 'This signing link is invalid or expired.'}</p>
      </div>
    </div>
  );

  // ── Done state ──
  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {done === 'signed'
          ? <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          : <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        }
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {done === 'signed' ? 'Thank You for Signing!' : 'Contract Declined'}
        </h1>
        <p className="text-gray-500">
          {done === 'signed'
            ? 'Your signature has been recorded. You will receive a confirmation email shortly.'
            : 'You have declined to sign this contract.'}
        </p>
      </div>
    </div>
  );

  // ── Main view ──
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Contract Signing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Please review the contract details below and provide your signature
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left panel — contract details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Contract details card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <CompanyLetterhead />
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mb-2">
                    {contract.contractNumber}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">{contract.title}</h2>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[contract.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[contract.status] || contract.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {TYPE_LABELS[contract.type] || contract.type}
                  </span>
                </div>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <DollarSign className="w-3.5 h-3.5" /> Value
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {contract.currency} {contract.value.toLocaleString()}
                  </p>
                </div>
                {contract.startDate && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <Calendar className="w-3.5 h-3.5" /> Start Date
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(contract.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {contract.endDate && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <Calendar className="w-3.5 h-3.5" /> End Date
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(contract.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <FileText className="w-3.5 h-3.5" /> Auto-Renewal
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {contract.autoRenewal ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Terms */}
              {contract.terms && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{contract.terms}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Signatories card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  Signatories
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {(contract.signatories || []).map((sig, idx) => (
                  <div key={sig.id || idx} className={`px-6 py-3 flex items-center justify-between ${
                    sig.isCurrentUser ? 'bg-purple-50' : ''
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {sig.signOrder}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {sig.name}
                          {sig.isCurrentUser && (
                            <span className="ml-2 text-xs text-purple-600 font-medium">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{sig.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        sig.signatoryType === 'internal'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {sig.signatoryType === 'internal' ? 'Internal' : 'External'}
                      </span>
                      <div className="flex items-center gap-1">
                        {SIG_STATUS_ICON[sig.status] || SIG_STATUS_ICON.pending}
                        <span className="text-xs text-gray-500 capitalize">{sig.status}</span>
                      </div>
                      {sig.signedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(sig.signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — signature */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">

              {canAct && !showDeclineForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <PenLine className="w-4 h-4 text-purple-600" />
                    Your Signature
                  </h3>

                  {/* Canvas */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50 mb-3">
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={150}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                  </div>

                  {hasSignature && (
                    <button
                      onClick={clearSignature}
                      className="text-xs text-gray-500 hover:text-gray-700 underline mb-4"
                    >
                      Clear signature
                    </button>
                  )}

                  <div className="space-y-2 mt-4">
                    <button
                      onClick={handleSign}
                      disabled={!hasSignature || !!acting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {acting === 'signing'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle className="w-4 h-4" />
                      }
                      Submit Signature
                    </button>
                    <button
                      onClick={() => setShowDeclineForm(true)}
                      disabled={!!acting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {canAct && showDeclineForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
                  <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    Decline Contract
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    Are you sure you want to decline? This action cannot be undone.
                  </p>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason for declining (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeclineForm(false); setDeclineReason(''); }}
                      disabled={!!acting}
                      className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDecline}
                      disabled={!!acting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {acting === 'declining'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />
                      }
                      Confirm Decline
                    </button>
                  </div>
                </div>
              )}

              {!canAct && contract.status === 'fully_signed' && (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-6 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-green-800 mb-1">Fully Signed</h3>
                  <p className="text-sm text-green-600">
                    All signatories have signed this contract.
                  </p>
                </div>
              )}

              {!canAct && contract.status === 'terminated' && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center">
                  <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-red-800 mb-1">Contract Terminated</h3>
                  <p className="text-sm text-red-600">
                    This contract has been terminated or declined.
                  </p>
                </div>
              )}

              {!canAct && !['fully_signed', 'terminated'].includes(contract.status) && currentSignatory?.status === 'signed' && (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-6 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-green-800 mb-1">You Have Signed</h3>
                  <p className="text-sm text-green-600">
                    Your signature has been recorded. Waiting for other signatories.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
