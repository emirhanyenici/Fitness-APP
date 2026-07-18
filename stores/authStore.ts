import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { stopSync } from '../services/sync';

interface AuthStore {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /**
   * True once the persisted session has been read from secure storage
   * (supabase.auth.getSession() resolved). Until then `session === null`
   * means "unknown", NOT "signed out" — routing must not treat it as
   * signed out (finding F9: cold start/reload dropped logged-in users
   * onto the login screen).
   */
  sessionResolved: boolean;
  markSessionResolved: () => void;
  setSession: (session: Session | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Returns true when Supabase issued a session right away (email
   * confirmation disabled) — the caller can route straight into the app.
   * False means a confirmation email is pending and sign-in must wait.
   */
  signUp: (email: string, password: string) => Promise<boolean>;
  /**
   * Native Sign in with Apple (iOS only). Runs the Apple sheet, then exchanges
   * the identity token with Supabase. Throws with code ERR_REQUEST_CANCELED
   * when the user dismisses the sheet.
   */
  signInWithApple: () => Promise<void>;
  /** Signs out and clears all user data from every persisted store. */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  isLoading: false,
  sessionResolved: false,

  markSessionResolved: () => set({ sessionResolved: true }),

  setSession: (session) => set({ session, user: session?.user ?? null }),

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isLoading: false });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    set({ isLoading: false });
    if (error) throw error;
    return data.session !== null;
  },

  signInWithApple: async () => {
    // Lazy import keeps the native module out of Android/web/Jest bundles.
    const { signInWithAppleNative } = await import('../services/appleAuth');
    const { identityToken, rawNonce, fullName } = await signInWithAppleNative();

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;

      // Apple only sends the name on the FIRST authorization — persist it now
      // or it is lost forever (Supabase does not capture it from the token).
      if (fullName && data.user && !data.user.user_metadata?.full_name) {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    // Stop cloud sync BEFORE clearing stores — otherwise the clears below would
    // be pushed up and wipe the user's cloud backup.
    stopSync();

    await supabase.auth.signOut();
    set({ session: null, user: null });

    // Clear every persisted store so no data leaks between users on the same device.
    // Lazy imports avoid circular dependency issues at module load time.
    const { useUserStore }           = await import('./userStore');
    const { useNutritionStore }      = await import('./nutritionStore');
    const { useWorkoutStore }        = await import('./workoutStore');
    const { useRecoveryStore }       = await import('./recoveryStore');
    const { useAISuggestionsStore }  = await import('./aiSuggestionsStore');
    const { useExerciseWeightStore } = await import('./exerciseWeightStore');
    const { useCustomProgramStore }  = await import('./customProgramStore');
    const { useWeightLogStore }      = await import('./weightLogStore');
    const { useAIChatStore }         = await import('./aiChatStore');
    const { useSubscriptionStore }   = await import('./subscriptionStore');

    useUserStore.getState().clearProfile();
    useNutritionStore.getState().clearEntries();
    useWorkoutStore.getState().clearHistory();
    useRecoveryStore.getState().clearEntries();
    useAISuggestionsStore.getState().clearAll();
    useExerciseWeightStore.getState().clearLogs();
    useCustomProgramStore.getState().clearAll();
    useWeightLogStore.getState().clearEntries();
    useAIChatStore.getState().clearAll();
    useSubscriptionStore.getState().setPlan('free');
  },
}));
