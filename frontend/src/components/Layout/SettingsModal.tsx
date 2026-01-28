import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import { validatePassword, getPasswordRules } from '../../utils/passwordValidation';
import { authApi } from '../../services/api';
import type { Invite } from '../../types';

const OPTIONAL_FIELDS = [
  { key: 'description', label: 'Book Description' },
  { key: 'genres', label: 'Genres' },
  { key: 'mood', label: 'Mood / Atmosphere' },
  { key: 'color_preference', label: 'Color Preference' },
  { key: 'character_description', label: 'Character Description' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'reference_image_description', label: 'Style Reference' },
];

type TabId = 'account' | 'preferences';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { effective, setTheme } = useTheme();
  const { user, supabaseUser, isAuthenticated, isLoading, logout, updatePreferences, updateEmail, updatePassword } = useAuth();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('account');

  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteData, setInviteData] = useState<{ code: string; invite_url: string; expires_at: string } | null>(null);
  const [inviteList, setInviteList] = useState<Invite[]>([]);
  const [inviteListLoading, setInviteListLoading] = useState(false);

  const [creditEmail, setCreditEmail] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditStatus, setCreditStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setNewEmail('');
      setEmailStatus(null);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus(null);
      setInviteStatus(null);
      setInviteData(null);
      setActiveTab('account');
      setInviteList([]);
      setCreditEmail('');
      setCreditAmount('');
      setCreditStatus(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.is_admin) return;
    
    const fetchInvites = async () => {
      setInviteListLoading(true);
      try {
        const data = await authApi.getInvites();
        setInviteList(data.invites);
      } catch {
        setInviteList([]);
      } finally {
        setInviteListLoading(false);
      }
    };
    
    fetchInvites();
  }, [isOpen, user?.is_admin]);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus(null);
    setEmailLoading(true);

    try {
      await updateEmail(newEmail);
      setEmailStatus({ type: 'success', message: 'Confirmation email sent to your new address.' });
      setNewEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update email';
      setEmailStatus({ type: 'error', message });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setPasswordStatus({ type: 'error', message: 'Please meet all password requirements.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setPasswordLoading(true);

    try {
      await updatePassword(newPassword);
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setPasswordStatus({ type: 'error', message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleInviteGenerate = async () => {
    setInviteLoading(true);
    setInviteStatus(null);
    try {
      const data = await authApi.createInvite();
      setInviteData(data);
      setInviteStatus({ type: 'success', message: 'Invite link generated.' });
      const listData = await authApi.getInvites();
      setInviteList(listData.invites);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create invite link';
      setInviteStatus({ type: 'error', message });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteCopy = async () => {
    if (!inviteData?.invite_url) return;
    try {
      await navigator.clipboard.writeText(inviteData.invite_url);
      setInviteStatus({ type: 'success', message: 'Invite link copied.' });
    } catch {
      setInviteStatus({ type: 'error', message: 'Failed to copy invite link.' });
    }
  };

  const handleInviteDelete = (id: number) => {
    const previousList = [...inviteList];
    setInviteList((prev) => prev.filter((inv) => inv.id !== id));
    
    authApi.deleteInvite(id).catch(() => {
      setInviteList(previousList);
      toast.error('Failed to delete invite');
    });
  };

  const handleGiveCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreditStatus(null);

    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount < 1) {
      setCreditStatus({ type: 'error', message: 'Please enter a valid amount (at least 1).' });
      return;
    }

    setCreditLoading(true);
    try {
      const result = await authApi.giveCredits(creditEmail, amount);
      setCreditStatus({ 
        type: 'success', 
        message: `Added ${amount} credits to ${result.email}. New balance: ${result.new_balance}` 
      });
      setCreditEmail('');
      setCreditAmount('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to give credits';
      const axiosError = err as { response?: { data?: { error?: string } } };
      const serverMessage = axiosError.response?.data?.error || message;
      setCreditStatus({ type: 'error', message: serverMessage });
    } finally {
      setCreditLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentEmail = supabaseUser?.email || user?.email || '';
  const showAccountSettings = isAuthenticated && !isLoading;

  const renderAccountTab = () => (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <span className="text-xs text-text-muted">
            {currentEmail}
          </span>
        </div>
        {emailStatus && (
          <div className={`mb-2 p-2 rounded-lg text-xs ${
            emailStatus.type === 'success'
              ? 'bg-success-bg border border-success-border text-success'
              : 'bg-error-bg border border-error-border text-error'
          }`}>
            {emailStatus.message}
          </div>
        )}
        <form onSubmit={handleEmailChange} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm"
            placeholder="New email address"
          />
          <button
            type="submit"
            disabled={emailLoading || !newEmail}
            className="w-full sm:w-auto px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {emailLoading ? 'Sending...' : 'Change Email'}
          </button>
        </form>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span className="text-xs text-text-muted">
            Change password
          </span>
        </div>
        {passwordStatus && (
          <div className={`mb-2 p-2 rounded-lg text-xs ${
            passwordStatus.type === 'success'
              ? 'bg-success-bg border border-success-border text-success'
              : 'bg-error-bg border border-error-border text-error'
          }`}>
            {passwordStatus.message}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm"
              placeholder="New password"
            />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="flex-1 w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm"
              placeholder="Confirm password"
            />
          </div>
          {newPassword.length > 0 && (
            <ul className="space-y-0.5">
              {getPasswordRules(newPassword).map((rule) => (
                <li
                  key={rule.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    rule.met ? 'text-success' : 'text-text-muted'
                  }`}
                >
                  {rule.met ? (
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-xs text-error">Passwords do not match.</p>
          )}
          <button
            type="submit"
            disabled={passwordLoading || !newPassword || !confirmPassword || validatePassword(newPassword).length > 0 || newPassword !== confirmPassword}
            className="w-full sm:w-auto px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {user?.is_admin && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            <span className="text-xs text-text-muted">
              Invite links (expires in 7 days)
            </span>
          </div>
          {inviteStatus && (
            <div className={`mb-2 p-2 rounded-lg text-xs ${
              inviteStatus.type === 'success'
                ? 'bg-success-bg border border-success-border text-success'
                : 'bg-error-bg border border-error-border text-error'
            }`}>
              {inviteStatus.message}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleInviteGenerate}
              disabled={inviteLoading}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {inviteLoading ? 'Generating...' : 'Generate Invite'}
            </button>
            <button
              type="button"
              onClick={handleInviteCopy}
              disabled={!inviteData?.invite_url}
              className="px-3 py-1.5 bg-surface-alt border border-border rounded-lg text-sm font-medium text-text-secondary hover:text-text hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Copy Link
            </button>
          </div>
          {inviteData && (
            <div className="mt-2 space-y-1.5">
              <input
                type="text"
                readOnly
                value={inviteData.invite_url}
                className="w-full px-3 py-1.5 bg-surface-alt border border-border rounded-lg text-text text-sm"
              />
              <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                <span>Code: {inviteData.code}</span>
                <span>Expires: {new Date(inviteData.expires_at).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">Your Invites</span>
              {inviteListLoading && (
                <span className="text-xs text-text-muted">Loading...</span>
              )}
            </div>
            {inviteList.length === 0 && !inviteListLoading ? (
              <p className="text-xs text-text-muted">No invites generated yet.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-alt/50">
                      <th className="text-left px-3 py-2 font-medium text-text-secondary">Code</th>
                      <th className="text-left px-3 py-2 font-medium text-text-secondary">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-text-secondary">Created</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inviteList.map((invite) => {
                      const now = new Date();
                      const expiresAt = new Date(invite.expires_at);
                      const isUsed = invite.used_at !== null;
                      const isExpired = !isUsed && expiresAt < now;
                      const isActive = !isUsed && !isExpired;

                      const frontendUrl = window.location.origin;
                      const inviteUrl = `${frontendUrl}/login?invite=${invite.code}`;

                      const handleCopyCode = async () => {
                        try {
                          await navigator.clipboard.writeText(inviteUrl);
                          setInviteStatus({ type: 'success', message: 'Invite link copied.' });
                        } catch {
                          setInviteStatus({ type: 'error', message: 'Failed to copy.' });
                        }
                      };

                      const formatDate = (dateStr: string) => {
                        const date = new Date(dateStr);
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      };

                      return (
                        <tr key={invite.id} className="hover:bg-surface-alt/30">
                          <td className="px-3 py-2">
                            <button
                              onClick={handleCopyCode}
                              className="font-mono text-text hover:text-accent transition-colors"
                              title="Click to copy invite link"
                            >
                              {invite.code.slice(0, 8)}...
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            {isUsed && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-info-bg text-info border border-info-border">
                                Used
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-alt text-text-muted border border-border">
                                Expired
                              </span>
                            )}
                            {isActive && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-bg text-success border border-success-border">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-text-muted">
                            {formatDate(invite.created_at)}
                          </td>
                                          <td className="px-2 py-2">
                                            <button
                                              onClick={() => handleInviteDelete(invite.id)}
                                              className="p-1 text-text-muted hover:text-error transition-colors"
                                              title="Delete invite"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                              </svg>
                                            </button>
                                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {user?.is_admin && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-xs text-text-muted">
              Give credits to a user
            </span>
          </div>
          {creditStatus && (
            <div className={`mb-2 p-2 rounded-lg text-xs ${
              creditStatus.type === 'success'
                ? 'bg-success-bg border border-success-border text-success'
                : 'bg-error-bg border border-error-border text-error'
            }`}>
              {creditStatus.message}
            </div>
          )}
          <form onSubmit={handleGiveCredits} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={creditEmail}
                onChange={(e) => setCreditEmail(e.target.value)}
                className="flex-1 w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm"
                placeholder="User email address"
              />
              <input
                type="number"
                required
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full sm:w-24 px-3 py-2 bg-surface-alt border border-border rounded-lg text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 text-sm"
                placeholder="Amount"
              />
            </div>
            <button
              type="submit"
              disabled={creditLoading || !creditEmail || !creditAmount}
              className="w-full sm:w-auto px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creditLoading ? 'Giving...' : 'Give Credits'}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Theme</span>
          <div className="flex bg-surface-alt border border-border rounded-lg p-0.5">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                effective === 'light'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                effective === 'dark'
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
              Dark
            </button>
          </div>
        </div>
      </div>

      {showAccountSettings && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text">Default Form Fields</span>
            {saving && (
              <span className="text-xs text-text-muted">Saving...</span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-3">
            Choose which optional fields appear by default on the generation form.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OPTIONAL_FIELDS.map(({ key, label }) => {
              const visibleFields = user?.preferences?.visible_fields || [];
              const isActive = visibleFields.includes(key);

              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={async () => {
                    const newFields = isActive
                      ? visibleFields.filter((f) => f !== key)
                      : [...visibleFields, key];
                    setSaving(true);
                    try {
                      await updatePreferences({ visible_fields: newFields });
                    } catch {

                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`group flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-surface-alt text-text-secondary border-border hover:border-accent/40 hover:text-text'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      isActive ? 'bg-white' : 'bg-border-strong group-hover:bg-accent/40'
                    }`}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      <div className="relative bg-surface border border-border rounded-2xl shadow-lg w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="text-lg font-heading font-semibold text-text tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-alt transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!showAccountSettings ? (
          <div className="p-4">
            <div className="bg-surface-alt/60 border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-text">Sign in to manage your account</p>
              <p className="text-xs text-text-muted mt-1">
                Log in to update your email, password, and preferences.
              </p>
              <div className="mt-3">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="inline-flex items-center justify-center bg-accent text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  Login
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">Theme</span>
                <div className="flex bg-surface-alt border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                      effective === 'light'
                        ? 'bg-surface text-text shadow-sm border border-border'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                    </svg>
                    Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                      effective === 'dark'
                        ? 'bg-surface text-text shadow-sm border border-border'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                    </svg>
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 pt-4">
              <div className="flex bg-surface-alt/60 border border-border rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'account'
                      ? 'bg-surface text-text shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Account
                </button>
                <button
                  onClick={() => setActiveTab('preferences')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'preferences'
                      ? 'bg-surface text-text shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Preferences
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'account' && renderAccountTab()}
              {activeTab === 'preferences' && renderPreferencesTab()}
            </div>

            <div className="border-t border-border p-4 flex justify-end">
              <button
                type="button"
                onClick={() => { logout(); onClose(); }}
                className="text-sm text-text-muted hover:text-accent transition-colors"
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
