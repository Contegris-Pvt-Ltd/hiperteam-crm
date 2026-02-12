import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Building2, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Loader2, Shield, Mail, User } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';

interface InvitationInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  roleName: string;
  departmentName: string;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  // Validation state
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password strength
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength] || '';
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'][strength] || '';

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token found. Please check your email for the correct link.');
      setLoading(false);
      return;
    }

    const validate = async () => {
      try {
        const res = await api.get(`/auth/invite/validate?token=${encodeURIComponent(token)}`);
        setInvitation(res.data.invitation);
        setTenant(res.data.tenant);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          || 'This invitation link is invalid or has expired.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [token]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Validation
    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/invite/accept', { token, password });
      const { user, tenant: tenantData, accessToken, refreshToken } = res.data;

      // Store auth data
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('tenant', JSON.stringify(tenantData));

      setSuccess(true);

      // Navigate to dashboard after brief delay
      setTimeout(() => {
        // Update auth store
        useAuthStore.getState().checkAuth();
        navigate('/');
      }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to accept invitation. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">HiperTeam</h1>
              <p className="text-emerald-200 text-sm">CRM Platform</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            You've been invited<br />to join {tenant?.name || 'the team'}.
          </h2>
          <p className="text-emerald-100 text-lg max-w-md">
            Set your password below to get started with your new account.
          </p>
        </div>

        <div className="relative text-emerald-200/60 text-sm">
          © {new Date().getFullYear()} HiperTeam. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">HiperTeam</span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Validating your invitation...</h3>
              <p className="text-gray-500 dark:text-slate-400 mt-2 text-sm">Please wait a moment.</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invitation Invalid</h3>
              <p className="text-gray-500 dark:text-slate-400 mt-2 text-sm max-w-sm mx-auto">{error}</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700"
              >
                Go to Login
              </Link>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Welcome aboard!</h3>
              <p className="text-gray-500 dark:text-slate-400 mt-2 text-sm">
                Your account is ready. Redirecting to your dashboard...
              </p>
              <div className="mt-4">
                <div className="animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
              </div>
            </div>
          )}

          {/* Invitation Form */}
          {!loading && !error && !success && invitation && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Accept Your Invitation</h2>
                <p className="text-gray-500 dark:text-slate-400 mt-2">
                  Set up your password to join <span className="font-medium text-gray-700 dark:text-slate-200">{tenant?.name}</span>.
                </p>
              </div>

              {/* Invitation details card */}
              <div className="bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-4 mb-6 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-slate-300">{invitation.email}</span>
                </div>
                {(invitation.firstName || invitation.lastName) && (
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {invitation.firstName} {invitation.lastName}
                      {invitation.jobTitle && <span className="text-gray-400 dark:text-slate-500"> · {invitation.jobTitle}</span>}
                    </span>
                  </div>
                )}
                {invitation.roleName && (
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {invitation.roleName}
                      {invitation.departmentName && <span className="text-gray-400 dark:text-slate-500"> · {invitation.departmentName}</span>}
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Create Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full pl-12 pr-12 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Minimum 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`flex-1 rounded-full transition-all ${level <= strength ? strengthColor : ''}`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs mt-1 ${
                        strength >= 4 ? 'text-emerald-600 dark:text-emerald-400'
                        : strength >= 3 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-500'
                      }`}>
                        {strengthLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className={`w-full pl-12 pr-12 py-3 bg-white dark:bg-slate-900 border rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-200 dark:border-slate-700'
                      }`}
                      placeholder="Re-enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                {/* Error */}
                {submitError && (
                  <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {submitError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || password.length < 8 || password !== confirmPassword}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Setting up your account...
                    </>
                  ) : (
                    <>
                      Accept & Join
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}