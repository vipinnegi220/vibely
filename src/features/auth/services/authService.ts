import { supabase } from '@/lib/supabase';
import { generateGuestName } from '@/lib/utils';
import type { Database } from '@/shared/types/database';

type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

export const authService = {
    async signInAnonymously() {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return data;
    },

    async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) throw error;
        return data;
    },

    async signInAsGuest() {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;

        if (data.user) {
            const profile: ProfileInsert = {
                id: data.user.id,
                nickname: generateGuestName(),
                interests: [],
                is_online: true,
                last_seen: new Date().toISOString(),
            };
            await supabase.from('profiles').upsert(profile);
        }

        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getSession() {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
        return supabase.auth.onAuthStateChange(callback);
    },
};
