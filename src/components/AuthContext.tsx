import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserProfile, UserRole } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateRoleInProfile: (role: UserRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginAsPatient: (email: string, password: string) => Promise<void>;
  registerAsPatient: (data: any) => Promise<void>;
  forgotPasswordAsPatient: (email: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPatientSession, setIsPatientSession] = useState(false);

  // Function to refresh the profile from PostgreSQL database
  const fetchProfile = async (idToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        console.error('Failed to fetch backend profile status:', res.statusText);
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile from database:', err);
      setProfile(null);
    }
  };

  // Function to refresh the profile from Patient Portal database
  const fetchPatientProfile = async (pToken: string) => {
    try {
      const res = await fetch('/api/portal/me', {
        headers: {
          'Authorization': `Bearer ${pToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          id: data.user.id,
          uid: data.user.uid,
          email: data.user.email,
          name: data.user.name,
          role: 'patient',
          createdAt: new Date(data.user.createdAt)
        });
        setUser({
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.name,
        } as any);
        setIsPatientSession(true);
      } else {
        localStorage.removeItem('patient_token');
        setToken(null);
        setProfile(null);
        setUser(null);
        setIsPatientSession(false);
      }
    } catch (err) {
      console.error('Error fetching patient profile:', err);
      localStorage.removeItem('patient_token');
      setToken(null);
      setProfile(null);
      setUser(null);
      setIsPatientSession(false);
    }
  };

  useEffect(() => {
    const localToken = localStorage.getItem('patient_token');
    if (localToken) {
      setLoading(true);
      setToken(localToken);
      fetchPatientProfile(localToken).finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (localStorage.getItem('patient_token')) {
        // Bypass Firebase user syncing if standard patient JWT is active
        return;
      }
      setLoading(true);
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setUser(firebaseUser);
        setToken(idToken);
        await fetchProfile(idToken);
      } else {
        setUser(null);
        setToken(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('patient_token');
      setIsPatientSession(false);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Error signing in with Google:', err);
      setLoading(false);
      throw err;
    }
  };

  const loginAsPatient = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.message || 'Login failed');
      }

      localStorage.setItem('patient_token', result.data.accessToken);
      setToken(result.data.accessToken);
      setProfile({
        id: result.data.user.id,
        uid: result.data.user.uid,
        email: result.data.user.email,
        name: result.data.user.name,
        role: 'patient',
        createdAt: new Date(),
      });
      setUser({
        uid: result.data.user.uid,
        email: result.data.user.email,
        displayName: result.data.user.name,
      } as any);
      setIsPatientSession(true);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerAsPatient = async (data: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.message || 'Registration failed');
      }

      localStorage.setItem('patient_token', result.data.accessToken);
      setToken(result.data.accessToken);
      setProfile({
        id: result.data.user.id,
        uid: result.data.user.uid,
        email: result.data.user.email,
        name: result.data.user.name,
        role: 'patient',
        createdAt: new Date(),
      });
      setUser({
        uid: result.data.user.uid,
        email: result.data.user.email,
        displayName: result.data.user.name,
      } as any);
      setIsPatientSession(true);
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const forgotPasswordAsPatient = async (email: string, newPass: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: newPass }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.message || 'Password reset failed');
      }
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (localStorage.getItem('patient_token')) {
        localStorage.removeItem('patient_token');
        setIsPatientSession(false);
        setToken(null);
        setProfile(null);
        setUser(null);
      } else {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateRoleInProfile = async (role: UserRole) => {
    if (!token || isPatientSession) return;
    try {
      const res = await fetch('/api/auth/role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        const data = await res.json();
        if (profile) {
          setProfile({ ...profile, role: data.role });
        }
      }
    } catch (err) {
      console.error('Failed to update user role:', err);
    }
  };

  const refreshProfile = async () => {
    const localToken = localStorage.getItem('patient_token');
    if (localToken) {
      await fetchPatientProfile(localToken);
    } else if (token) {
      await fetchProfile(token);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      token,
      loading,
      loginWithGoogle,
      logout,
      updateRoleInProfile,
      refreshProfile,
      loginAsPatient,
      registerAsPatient,
      forgotPasswordAsPatient
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
