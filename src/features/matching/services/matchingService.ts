import { supabase } from '@/lib/supabase';
import type { Match } from '@/shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const matchingService = {
    async joinQueue(userId: string, chatType: 'text' | 'video', genderFilter = 'any', countryFilter: string | null = null, interests: string[] = []) {
        // Remove any existing queue entry first
        await db.from('waiting_queue').delete().eq('user_id', userId);

        const { data, error } = await db.from('waiting_queue').insert({
            user_id: userId,
            gender_filter: genderFilter,
            country_filter: countryFilter,
            interests,
            chat_type: chatType,
        }).select().single();

        if (error) throw error;
        return data;
    },

    async leaveQueue(userId: string) {
        await db.from('waiting_queue').delete().eq('user_id', userId);
    },

    async findMatch(userId: string, chatType: 'text' | 'video'): Promise<Match | null> {
        // Find someone else waiting with same chat type, not the current user
        const { data: candidates } = await db
            .from('waiting_queue')
            .select('user_id')
            .eq('chat_type', chatType)
            .neq('user_id', userId)
            .order('joined_at', { ascending: true })
            .limit(1);

        if (!candidates || candidates.length === 0) return null;

        const partnerId = candidates[0].user_id;

        // Create a match
        const { data: match, error } = await db
            .from('matches')
            .insert({
                user1_id: userId,
                user2_id: partnerId,
                chat_type: chatType,
                status: 'active',
            })
            .select()
            .single();

        if (error) throw error;

        // Remove both from queue
        await db.from('waiting_queue').delete().in('user_id', [userId, partnerId]);

        return match as Match;
    },

    async endMatch(matchId: string) {
        await db
            .from('matches')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', matchId);
    },

    async getActiveMatch(userId: string): Promise<Match | null> {
        const { data } = await db
            .from('matches')
            .select('*')
            .eq('status', 'active')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();

        return data as Match | null;
    },

    subscribeToQueue(userId: string, onMatch: (match: Match) => void) {
        const channel = supabase
            .channel(`queue:${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'matches',
                filter: `user1_id=eq.${userId}`,
            }, (payload) => onMatch(payload.new as Match))
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'matches',
                filter: `user2_id=eq.${userId}`,
            }, (payload) => onMatch(payload.new as Match))
            .subscribe();

        return () => supabase.removeChannel(channel);
    },
};
