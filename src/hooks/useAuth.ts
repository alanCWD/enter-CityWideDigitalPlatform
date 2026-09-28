import { useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Failsafe bound on the initial session read, so an unresponsive backend can
 *  never leave the app stuck on a loading spinner forever. */
const SESSION_TIMEOUT_MS = 10_000;

/**
 * Auth hook. Subscribes to onAuthStateChange BEFORE checking for an existing
 * session, per Enter Cloud best practices.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    // Failsafe: release the loading gate even if the session read never settles
    // (e.g. a token refresh that the backend never answers).
    const failsafe = setTimeout(() => setLoading(false), SESSION_TIMEOUT_MS);
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => { /* leave session null — the UI must not hang on this */ })
      .finally(() => {
        clearTimeout(failsafe);
        setLoading(false);
      });
    return () => {
      clearTimeout(failsafe);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    [],
  );
  const signUp = useCallback(
    (email: string, password: string) =>
      supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      }),
    [],
  );
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, user, loading, signIn, signUp, signOut };
}
