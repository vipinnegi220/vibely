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

        if (error) {
            console.error('[matching] joinQueue error:', error);
            throw error;
        }
        console.log('[matching] joined queue:', data);
        return data;
    },

    async leaveQueue(userId: string) {
        await db.from('waiting_queue').delete().eq('user_id', userId);
    },

    async tryMatch(userId: string, chatType: 'text' | 'video'): Promise<Match | null> {
        const { data: candidates, error: fetchError } = await db
            .from('waiting_queue')
            .select('user_id, joined_at')
            .eq('chat_type', chatType)
            .neq('user_id', userId)
            .order('joined_at', { ascending: true })
            .limit(1);

        if (fetchError) {
            console.error('[matching] fetch candidates error:', fetchError);
            return null;
        }

        console.log('[matching] candidates found:', candidates?.length ?? 0, candidates);
        if (!candidates || candidates.length === 0) return null;

        const partnerId = candidates[0].user_id;
        console.log('[matching] attempting match with partner:', partnerId);

        const { error: deleteError } = await db
            .from('waiting_queue')
            .delete()
            .in('user_id', [userId, partnerId]);

        if (deleteError) {
            console.error('[matching] delete queue error:', deleteError);
            return null;
        }

        const { data: match, error: matchError } = await db
            .from('matches')
            .insert({
                user1_id: partnerId,
                user2_id: userId,
                chat_type: chatType,
                status: 'active',
            })
            .select()
            .single();

        if (matchError) {
            console.error('[matching] create match error:', matchError);
            return null;
        }

        console.log('[matching] match created:', match);
        return match as Match;
    },

    async endMatch(matchId: string) {
        await db
            .from('matches')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', matchId);
    },

    subscribeToMatches(userId: string, onMatch: (match: Match) => void) {
        console.log('[matching] subscribing to matches for:', userId);
        const channel = supabase
            .channel(`user-match:${userId}`)
            .on('broadcast', { event: 'matched' }, ({ payload }) => {
                console.log('[matching] received match broadcast:', payload);
                onMatch(payload as Match);
            })
            .subscribe((status) => {
                console.log('[matching] subscription status:', status);
            });

        return () => supabase.removeChannel(channel);
    },

    async notifyMatch(partnerId: string, match: Match) {
        console.log('[matching] notifying partner:', partnerId);
        return new Promise<void>((resolve) => {
            const ch = supabase.channel(`user-match:${partnerId}`);
            ch.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    ch.send({
                        type: 'broadcast',
                        event: 'matched',
                        payload: match,
                    }).then(() => {
                        console.log('[matching] partner notified');
                        setTimeout(() => supabase.removeChannel(ch), 3000);
                        resolve();
                    });
                }
            });
        });
    },
};
