import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { authService } from '@/features/auth/services/authService';
import { generateGuestName } from '@/lib/utils';
import { toast } from '@/shared/hooks/useToast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function fetchOrCreateProfile(userId: string) {
    // Use maybeSingle to avoid 406 when row doesn't exist
    const { data: existing } = await db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (existing) return existing;

    // Auto-create profile for anonymous/guest users
    const { data: created } = await db
        .from('profiles')
        .insert({
            id: userId,
            nickname: generateGuestName(),
            interests: [],
            is_online: true,
            last_seen: new Date().toISOString(),
        })
        .select()
        .single();

    return created;
}

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
                    const profile = await fetchOrCreateProfile(session.user.id);
                    if (mounted) setProfile(profile);
                }
            } catch {
                // silent
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
                    const profile = await fetchOrCreateProfile(session.user.id);
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
