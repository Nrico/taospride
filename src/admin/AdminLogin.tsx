import React, { useState } from 'react';
import { AdminApiError, adminApi } from './adminApi';

// Single login screen for the unified /admin portal — one password for
// site content, board portal, and (from Phase 3) the gallery admin.
export default function AdminLogin({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await adminApi.post('/api/auth/login', { password });
      if (result.success) {
        sessionStorage.setItem('tp_admin', '1');
        onAuthed();
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'password_migration_required') {
        setMigrationRequired(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Invalid password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 16) {
      setError('Your new password must be at least 16 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminApi.post('/api/auth/migrate-password', {
        currentPassword: password,
        newPassword,
      });
      if (result.success) {
        sessionStorage.setItem('tp_admin', '1');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onAuthed();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The security upgrade could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-xl p-10">
        <div className="flex items-center gap-3 mb-8">
          <img src="/TaosPrideLogo.png" alt="Taos Pride" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-lg font-black text-gray-900">Taos Pride Admin</h1>
            <p className="text-xs text-gray-400">Site, board &amp; volunteers — one login</p>
          </div>
        </div>
        {migrationRequired ? (
          <form onSubmit={handleMigration} className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-900">One-time security upgrade</p>
              <p className="text-xs leading-relaxed text-amber-800 mt-1">
                Choose a new password. It will be securely hashed on the server, and the old plaintext credentials will be removed.
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-2">Current password</label>
              <input type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-pink-500 text-sm font-medium transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-2">New password</label>
              <input type="password" autoComplete="new-password" minLength={16} maxLength={256} value={newPassword}
                onChange={e => setNewPassword(e.target.value)} placeholder="At least 16 characters"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-pink-500 text-sm font-medium transition-colors" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-2">Confirm new password</label>
              <input type="password" autoComplete="new-password" minLength={16} maxLength={256} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-pink-500 text-sm font-medium transition-colors" />
            </div>
            {error && <p role="alert" className="text-xs text-red-500 font-semibold">{error}</p>}
            <button type="submit" disabled={submitting || !password || !newPassword || !confirmPassword}
              className="w-full bg-pink-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-pink-600 transition-colors disabled:opacity-60">
              {submitting ? 'Securing Account…' : 'Secure Account & Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-2">Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-2 outline-none focus:border-pink-500 text-sm font-medium transition-colors"
            />
            {error && <p role="alert" className="text-xs text-red-500 font-semibold mb-3">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-pink-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-pink-600 transition-colors mt-3 disabled:opacity-60"
            >
              {submitting ? 'Signing In…' : 'Sign In'}
            </button>
          </form>
        )}
        <a href="/" className="block text-center mt-5 text-xs text-gray-400 hover:text-gray-600 transition-colors">← Return to public site</a>
      </div>
    </div>
  );
}
