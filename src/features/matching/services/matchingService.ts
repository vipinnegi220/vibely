import { supabase } from '@/lib/supabase';
import type { Match, ChatType } from '@/shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const matchingService = {
    async joinQueue(
        userId: string,
        chatType: ChatType,
        genderFilter = 'any',
        countryFilter: string | null = null,
        interests: string[] = []
    ) {
        await db.from('waiting_queue').delete().eq('user_id', userId);
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
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

    async tryMatch(userId: string, chatType: ChatType): Promise<Match | null> {
        // Match by exact chat_type — text↔text, audio↔audio, video↔video
        const { data: candidates, error: fetchError } = await db
            .from('waiting_queue')
            .select('user_id, chat_type, joined_at')
            .eq('chat_type', chatType)
            .neq('user_id', userId)
            .order('joined_at', { ascending: true })
            .limit(1);

        if (fetchError) { console.error('[matching] fetch error:', fetchError); return null; }
        console.log('[matching] candidates for', chatType, ':', candidates?.length ?? 0, candidates);
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

        console.log('[matching] match created:', match.id, 'type:', chatType);
        return match as Match;
    },

    async endMatch(matchId: string) {
        await db
            .from('matches')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', matchId);
    },

    // Notify partner of a chat type switch request
    broadcastTypeSwitch(matchId: string, userId: string, newType: ChatType) {
        return supabase.channel(`type-switch:${matchId}`)
            .send({
                type: 'broadcast',
                event: 'type-switch',
                payload: { from: userId, newType },
            });
    },

    subscribeToTypeSwitch(
        matchId: string,
        userId: string,
        onSwitch: (newType: ChatType) => void
    ) {
        const channel = supabase
            .channel(`type-switch:${matchId}`)
            .on('broadcast', { event: 'type-switch' }, ({ payload }) => {
                if (payload.from !== userId) {
                    console.log('[matching] partner switched type to:', payload.newType);
                    onSwitch(payload.newType as ChatType);
                }
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    },
};
