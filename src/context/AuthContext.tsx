import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  syncUserProfile,
  signInWithGoogle,
  loginWithEmail as fbLoginWithEmail,
  registerWithEmail as fbRegisterWithEmail,
  sendPasswordReset as fbSendPasswordReset,
  loginWithWhitelistDirect,
  logOut as fbLogOut,
  getLocalSession,
  saveLocalSession,
  clearLocalSession,
  BOOTSTRAP_ADMIN_EMAIL,
  isSuperAdminEmail
} from '../services/firebase';
import { UserProfile, AppModule, ActionType, DepartmentName } from '../types';
import { canUserAccessModule, canUserPerformAction } from '../services/permissionService';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isTeamMember: boolean;
  isReadOnly: boolean;
  department: DepartmentName;
  canAccess: (module: AppModule) => boolean;
  canPerform: (module: AppModule, action: ActionType) => boolean;
  authSecurityError: string | null;
  clearAuthSecurityError: () => void;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithWhitelist: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => getLocalSession());
  const [loading, setLoading] = useState(true);
  const [authSecurityError, setAuthSecurityError] = useState<string | null>(null);

  const clearAuthSecurityError = () => setAuthSecurityError(null);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      try {
        const profile = await syncUserProfile(auth.currentUser);
        setUser(profile);
        saveLocalSession(profile);
      } catch (e: any) {
        console.warn('Could not refresh profile', e);
        if (e?.message?.includes('ACCESS_DENIED')) {
          setUser(null);
          clearLocalSession();
          setAuthSecurityError(e.message);
        }
      }
    }
  };

  useEffect(() => {
    // Check initial local session
    const saved = getLocalSession();
    if (saved) {
      setUser(saved);
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await syncUserProfile(fbUser);
          setUser(profile);
          saveLocalSession(profile);
          setAuthSecurityError(null);
        } catch (e: any) {
          console.error('Unauthorized session rejected:', e);
          setUser(null);
          clearLocalSession();
          setFirebaseUser(null);
          if (e?.message?.includes('ACCESS_DENIED')) {
            setAuthSecurityError(e.message.replace(/^ACCESS_DENIED:\s*/, ''));
          } else {
            setAuthSecurityError(e?.message || 'Access denied for this account.');
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInGoogle = async () => {
    setAuthSecurityError(null);
    const profile = await signInWithGoogle();
    setUser(profile);
    saveLocalSession(profile);
  };

  const signInEmail = async (email: string, pass: string) => {
    setAuthSecurityError(null);
    const profile = await fbLoginWithEmail(email, pass);
    setUser(profile);
    saveLocalSession(profile);
  };

  const signUpEmail = async (email: string, pass: string, name: string) => {
    setAuthSecurityError(null);
    const profile = await fbRegisterWithEmail(email, pass, name);
    setUser(profile);
    saveLocalSession(profile);
  };

  const signInWithWhitelist = async (email: string) => {
    setAuthSecurityError(null);
    const profile = await loginWithWhitelistDirect(email);
    setUser(profile);
    saveLocalSession(profile);
  };

  const resetPassword = async (email: string) => {
    await fbSendPasswordReset(email);
  };

  const signOut = async () => {
    clearLocalSession();
    await fbLogOut();
    setUser(null);
    setFirebaseUser(null);
    setAuthSecurityError(null);
  };

  const isSuperAdmin = !!user && (
    isSuperAdminEmail(user.email) ||
    (user.role as any) === 'SUPER_ADMIN' ||
    user.role === 'super_admin' ||
    user.isSuperAdmin === true
  );
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  const isManager = isAdmin || user?.role === 'manager';
  const isReadOnly = user?.role === 'read_only';
  const isTeamMember = !!user && (user.role === 'team_member' || (!isReadOnly && !isManager && !isAdmin));
  const department: DepartmentName = user?.department || (isSuperAdmin ? 'Executive' : 'General');

  const canAccess = (module: AppModule): boolean => {
    return canUserAccessModule(user, module);
  };

  const canPerform = (module: AppModule, action: ActionType): boolean => {
    return canUserPerformAction(user, module, action);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isSuperAdmin,
        isAdmin,
        isManager,
        isTeamMember,
        isReadOnly,
        department,
        canAccess,
        canPerform,
        authSecurityError,
        clearAuthSecurityError,
        signInGoogle,
        signInEmail,
        signUpEmail,
        signInWithWhitelist,
        resetPassword,
        signOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
