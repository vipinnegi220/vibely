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
        // Remove own stale entries first
        await db.from('waiting_queue').delete().eq('user_id', userId);

        // Also clean up entries older than 3 minutes (stale from closed tabs)
        const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        await db.from('waiting_queue').delete().lt('joined_at', cutoff);

        const { data, error } = await db
            .from('waiting_queue')
            .insert({ user_id: userId, gender_filter: genderFilter, country_filter: countryFilter, interests, chat_type: chatType })
            .select()
            .single();
        if (error) { console.error('[matching] joinQueue error:', error); throw error; }
        console.log('[matching] joined queue:', data);
        return data;
    },

    async leaveQueue(userId: string) {
        await db.from('waiting_queue').delete().eq('user_id', userId);
    },

    async getActiveMatch(userId: string): Promise<Match | null> {
        const { data } = await db
            .from('matches')
            .select('*')
            .eq('status', 'active')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return data as Match | null;
    },

    async tryMatch(userId: string, chatType: 'text' | 'video'): Promise<Match | null> {
        // Only consider entries from the last 3 minutes (avoids matching stale entries)
        const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();

        const { data: candidates, error: fetchError } = await db
            .from('waiting_queue')
            .select('user_id, joined_at')
            .eq('chat_type', chatType)
            .neq('user_id', userId)
            .gte('joined_at', cutoff)
            .order('joined_at', { ascending: true })
            .limit(1);

        if (fetchError) { console.error('[matching] fetch error:', fetchError); return null; }
        console.log('[matching] candidates:', candidates?.length ?? 0);
        if (!candidates || candidates.length === 0) return null;

        const partnerId = candidates[0].user_id;
        console.log('[matching] matching with:', partnerId);

        const { error: deleteError } = await db
            .from('waiting_queue')
            .delete()
            .in('user_id', [userId, partnerId]);
        if (deleteError) { console.error('[matching] delete error:', deleteError); return null; }

        const { data: match, error: matchError } = await db
            .from('matches')
            .insert({ user1_id: partnerId, user2_id: userId, chat_type: chatType, status: 'active' })
            .select()
            .single();
        if (matchError) { console.error('[matching] insert error:', matchError); return null; }

        console.log('[matching] match created:', match.id);
        return match as Match;
    },

    async endMatch(matchId: string) {
        await db
            .from('matches')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', matchId);
    },
};
