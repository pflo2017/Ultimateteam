import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ClubAdminLoginModalProps {
  open: boolean;
  onClose: () => void;
}

const ClubAdminLoginModal: React.FC<ClubAdminLoginModalProps> = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus trap and ESC to close
  useEffect(() => {
    if (open && firstInputRef.current) {
      firstInputRef.current.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Use Supabase login logic
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      if (data.user) {
        // Check if the user is a club admin
        const { data: clubData, error: clubError } = await supabase
          .from('clubs')
          .select('*')
          .eq('admin_id', data.user.id);
        if (clubError) throw clubError;
        if (!clubData || clubData.length === 0) {
          await supabase.auth.signOut();
          throw new Error('You do not have permission to access the club admin dashboard');
        }
        localStorage.setItem('userRole', 'clubAdmin');
        localStorage.setItem('clubId', clubData[0].id);
        localStorage.setItem('clubName', clubData[0].name);
        window.location.href = '/admin';
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="relative w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-8 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-admin-login-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 focus:outline-none"
          aria-label="Close login modal"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h2 id="club-admin-login-title" className="text-2xl font-bold text-center mb-2">Club Admin Login</h2>
        <p className="text-gray-500 text-center mb-6">Autentificare pentru administratori de club</p>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              ref={firstInputRef}
              id="email"
              type="email"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <button
              type="button"
              className="text-blue-600 hover:underline text-sm font-medium"
              onClick={() => window.location.href = '/reset-password'}
              tabIndex={0}
            >
              Forgot password?
            </button>
          </div>
          <button
            type="submit"
            className="w-full mt-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClubAdminLoginModal; 