import { supabase } from '@/lib/supabase';
import type { Match } from '@/shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const matchingService = {
    async joinQueue(
        userId: string,
        chatType: 'text' | 'video',
        genderFilter = 'any',
        countryFilter: string | null = null,
        interests: string[] = []
    ) {
        // Remove any stale entry first
        await db.from('waiting_queue').delete().eq('user_id', userId);

        const { data, error } = await db
            .from('waiting_queue')
            .insert({
                user_id: userId,
                gender_filter: genderFilter,
                country_filter: countryFilter,
                interests,
                chat_type: chatType,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async leaveQueue(userId: string) {
        await db.from('waiting_queue').delete().eq('user_id', userId);
    },

    // Called by the SECOND person to join — they find the first and create the match
    async tryMatch(userId: string, chatType: 'text' | 'video'): Promise<Match | null> {
        // Find oldest waiting person (not ourselves)
        const { data: candidates } = await db
            .from('waiting_queue')
            .select('user_id, joined_at')
            .eq('chat_type', chatType)
            .neq('user_id', userId)
            .order('joined_at', { ascending: true })
            .limit(1);

        if (!candidates || candidates.length === 0) return null;

        const partnerId = candidates[0].user_id;

        // Remove both from queue atomically before creating match
        // This prevents double-matching
        const { error: deleteError } = await db
            .from('waiting_queue')
            .delete()
            .in('user_id', [userId, partnerId]);

        if (deleteError) return null;

        // Create the match
        const { data: match, error: matchError } = await db
            .from('matches')
            .insert({
                user1_id: partnerId, // the one who was waiting first
                user2_id: userId,    // the one who just joined
                chat_type: chatType,
                status: 'active',
            })
            .select()
            .single();

        if (matchError) return null;
        return match as Match;
    },

    async endMatch(matchId: string) {
        await db
            .from('matches')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', matchId);
    },

    // Subscribe to new matches where this user is involved
    subscribeToMatches(userId: string, onMatch: (match: Match) => void) {
        // We listen on a user-specific broadcast channel
        const channel = supabase
            .channel(`user-match:${userId}`)
            .on('broadcast', { event: 'matched' }, ({ payload }) => {
                onMatch(payload as Match);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    },

    // Notify the partner they've been matched
    async notifyMatch(partnerId: string, match: Match) {
        await supabase.channel(`user-match:${partnerId}`).send({
            type: 'broadcast',
            event: 'matched',
            payload: match,
        });
    },
};
