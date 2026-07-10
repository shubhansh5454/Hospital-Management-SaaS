import { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from './AuthContext.tsx';
import { ShieldCheck, LogIn, HeartPulse, Sparkles, AlertCircle } from 'lucide-react';

export default function AuthScreen() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
      setSigningIn(false);
    }
  };

  return (
    <div id="auth_container" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f9ff] via-[#fafafa] to-[#f0fdf4] p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-8 relative overflow-hidden"
      >
        {/* Subtle decorative accents */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-50 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-4 border border-teal-100 shadow-sm">
            <HeartPulse className="w-8 h-8" />
          </div>
          
          <h1 className="text-2xl font-display font-bold text-gray-900 tracking-tight text-center">
            CareSync SaaS
          </h1>
          <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">
            Production-ready Hospital & Clinic Management Platform with Secure RBAC and Patient Workflows.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-sm text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication Error</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            id="google_signin_button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full h-12 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl font-medium shadow-md transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
          >
            {signingIn ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50/70 py-1.5 px-3 rounded-lg w-max">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Developer Sandbox Guide</span>
          </div>
          
          <p className="text-xs text-gray-500 leading-relaxed">
            Upon signing in for the first time, your profile is dynamically registered in 
            the PostgreSQL database.
          </p>

          <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-500">
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100/60">
              <span className="font-semibold text-gray-700 block mb-1">First Sign-In Role</span>
              Automatically configured as <strong className="text-teal-700">Admin</strong> to allow management testing.
            </div>
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100/60">
              <span className="font-semibold text-gray-700 block mb-1">Subsequent Users</span>
              Automatically registered with the <strong className="text-blue-700">Doctor</strong> role.
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            <span>Authenticated securely via Firebase ID Token & JWT</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
