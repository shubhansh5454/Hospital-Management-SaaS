import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { useAuth } from './AuthContext.tsx';
import { 
  HeartPulse, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Phone, 
  Calendar, 
  User as UserIcon, 
  Mail, 
  Lock 
} from 'lucide-react';

type AuthTab = 'patient' | 'staff';
type PatientMode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen() {
  const { loginWithGoogle, loginAsPatient, registerAsPatient, forgotPasswordAsPatient } = useAuth();
  
  const [activeTab, setActiveTab] = useState<AuthTab>('patient');
  const [patientMode, setPatientMode] = useState<PatientMode>('signin');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');

  const handleStaffLogin = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (patientMode === 'signin') {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        await loginAsPatient(email, password);
      } else if (patientMode === 'signup') {
        if (!name || !email || !password || !phone || !dob) {
          throw new Error('Please fill in all required fields (Name, Email, Password, Phone, Date of Birth).');
        }
        await registerAsPatient({
          name,
          email,
          password,
          phone,
          dob,
          gender,
          bloodGroup: bloodGroup || undefined,
          address: address || undefined,
        });
        setSuccess('Registration successful!');
      } else if (patientMode === 'forgot') {
        if (!email || !password) {
          throw new Error('Please enter your email and a new password.');
        }
        await forgotPasswordAsPatient(email, password);
        setSuccess('Password has been successfully updated. You can now Sign In!');
        setPatientMode('signin');
        setPassword('');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth_container" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-teal-50/30 p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-lg bg-white border border-slate-100 shadow-[0_10px_40px_rgb(0,0,0,0.03)] rounded-3xl p-8 relative overflow-hidden"
      >
        {/* Decorative background blur objects */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -z-10" />

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-teal-500 text-white rounded-2xl flex items-center justify-center mb-3 shadow-md shadow-teal-500/10">
            <HeartPulse className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight text-center">
            CareSync Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1 text-center max-w-sm">
            Full-Stack Electronic Health Registry & Patient Portal Suite
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => {
              setActiveTab('patient');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === 'patient'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Patient Portal
          </button>
          <button
            onClick={() => {
              setActiveTab('staff');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2.5 text-center text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === 'staff'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Clinic Staff
          </button>
        </div>

        {/* Message Banner for Errors and Successes */}
        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 text-xs text-red-600 animate-fadeIn">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Action Failed</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 bg-teal-50 border border-teal-100 rounded-2xl flex gap-3 text-xs text-teal-700 animate-fadeIn">
            <ShieldCheck className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="opacity-90">{success}</p>
            </div>
          </div>
        )}

        {/* CONTENT CHANNELS */}
        {activeTab === 'patient' ? (
          <form onSubmit={handlePatientSubmit} className="space-y-4">
            {/* Form Title & Context description */}
            <div className="mb-2">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {patientMode === 'signin' && 'Patient Sign In'}
                {patientMode === 'signup' && 'Patient Registration'}
                {patientMode === 'forgot' && 'Reset Password'}
              </h2>
              <p className="text-xs text-slate-400">
                {patientMode === 'signin' && 'Access your prescriptions, medical history, lab results, and book appointments.'}
                {patientMode === 'signup' && 'Register your clinical file and login account to book appointments and track diagnostics.'}
                {patientMode === 'forgot' && 'Enter your account email to set a new password.'}
              </p>
            </div>

            {/* REGISTER EXTRA FIELDS */}
            {patientMode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Full Name *</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date of Birth *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Blood Group</label>
                  <input
                    type="text"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="O+ or A-"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Health Ave, Suite 400"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* BASE EMAIL & PASSWORD FIELDS */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    {patientMode === 'forgot' ? 'New Password *' : 'Password *'}
                  </label>
                  {patientMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientMode('forgot');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-[10px] text-teal-600 hover:underline font-semibold cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:bg-white rounded-xl text-xs outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-xl text-xs shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {patientMode === 'signin' && <LogIn className="w-4.5 h-4.5" />}
                  {patientMode === 'signup' && <UserPlus className="w-4.5 h-4.5" />}
                  {patientMode === 'forgot' && <KeyRound className="w-4.5 h-4.5" />}
                  <span>
                    {patientMode === 'signin' && 'Sign In to Patient Portal'}
                    {patientMode === 'signup' && 'Create Patient Account'}
                    {patientMode === 'forgot' && 'Reset My Password'}
                  </span>
                </>
              )}
            </button>

            {/* TOGGLE LINKS */}
            <div className="text-center text-[11px] text-slate-400 mt-4">
              {patientMode === 'signin' ? (
                <p>
                  New patient?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setPatientMode('signup');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-teal-600 font-semibold hover:underline cursor-pointer"
                  >
                    Register here
                  </button>
                </p>
              ) : (
                <p>
                  Already have a patient account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setPatientMode('signin');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-teal-600 font-semibold hover:underline cursor-pointer"
                  >
                    Sign In instead
                  </button>
                </p>
              )}
            </div>
          </form>
        ) : (
          /* STAFF GOOGLE SIGN IN */
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Hospital & Clinic Staff
              </h2>
              <p className="text-xs text-slate-500">
                Secure enterprise login with role-based access control for Admins, Doctors, and Receptionists.
              </p>
            </div>

            <button
              id="google_signin_button"
              onClick={handleStaffLogin}
              disabled={loading}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4.5 h-4.5" />
                  <span>Authenticate with Google</span>
                </>
              )}
            </button>

            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50/70 py-1 px-2.5 rounded-lg w-max">
                <Sparkles className="w-3 h-3 text-teal-600" />
                <span>Developer Sandbox Configuration</span>
              </div>
              
              <p className="text-xs text-slate-400 leading-relaxed">
                Google Single Sign-On automatically registers accounts. Sandbox configurations set roles:
              </p>

              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-700 block mb-0.5">First Sign-In</span>
                  Automatically assigned the <strong className="text-teal-600 font-bold">Admin</strong> role for full configuration testing.
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-semibold text-slate-700 block mb-0.5">Subsequent Sign-Ins</span>
                  Automatically assigned the <strong className="text-blue-600 font-bold">Doctor</strong> role for EMR testing.
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Sessions authenticated via cryptographic ID Tokens</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
