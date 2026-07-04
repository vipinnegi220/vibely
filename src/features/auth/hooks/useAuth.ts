import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { authService } from '@/features/auth/services/authService';
import { toast } from '@/shared/hooks/useToast';

export function useAuthInit() {
    const { setUser, setSession, setProfile, setLoading, setInitialized } = useAuthStore();

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const session = await authService.getSession();
                if (!mounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (mounted) setProfile(profile);
                }
            } catch {
                // Session check failed silently
            } finally {
                if (mounted) {
                    setLoading(false);
                    setInitialized(true);
                }
            }
        }

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!mounted) return;
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (mounted) setProfile(profile);
                } else {
                    setProfile(null);
                }

                setLoading(false);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [setUser, setSession, setProfile, setLoading, setInitialized]);
}

export function useSignOut() {
    const { reset } = useAuthStore();

    return async () => {
        try {
            await authService.signOut();
            reset();
        } catch {
            toast({ title: 'Sign out failed', variant: 'destructive' });
        }
    };
}
