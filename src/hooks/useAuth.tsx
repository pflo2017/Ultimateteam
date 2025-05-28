'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: Error | null;
  }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [isParent, setIsParent] = useState(false);

  useEffect(() => {
    const setData = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Check user roles
          const { data: adminData } = await supabase
            .from('admins')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const { data: coachData } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const { data: parentData } = await supabase
            .from('parents')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          setIsAdmin(!!adminData);
          setIsCoach(!!coachData);
          setIsParent(!!parentData);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Check user roles
          const { data: adminData } = await supabase
            .from('admins')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const { data: coachData } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const { data: parentData } = await supabase
            .from('parents')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();

          setIsAdmin(!!adminData);
          setIsCoach(!!coachData);
          setIsParent(!!parentData);
        } else {
          setIsAdmin(false);
          setIsCoach(false);
          setIsParent(false);
        }

        setIsLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (error) {
      console.error('Error signing in:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signOut,
    isAdmin,
    isCoach,
    isParent,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 