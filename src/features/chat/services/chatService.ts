import { supabase } from '@/lib/supabase';
import type { Message } from '@/shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const BANNED = ['spam', 'scam'];
function filterProfanity(text: string): string {
    let out = text;
    BANNED.forEach((w) => {
        out = out.replace(new RegExp(`\\b${w}\\b`, 'gi'), '***');
    });
    return out;
}

export const chatService = {
    async sendMessage(matchId: string, senderId: string, content: string): Promise<Message> {
        const filtered = filterProfanity(content.trim());
        if (!filtered) throw new Error('Empty message');

        console.log('[chat] sending message', { matchId, senderId, content: filtered });

        const { data, error } = await db
            .from('messages')
            .insert({ match_id: matchId, sender_id: senderId, content: filtered })
            .select()
            .single();

        if (error) {
            console.error('[chat] send error:', error);
            throw error;
        }
        return data as Message;
    },

    async getMessages(matchId: string): Promise<Message[]> {
        const { data, error } = await db
            .from('messages')
            .select('*')
            .eq('match_id', matchId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[chat] getMessages error:', error);
            return [];
        }
        return (data ?? []) as Message[];
    },

    subscribeToMessages(matchId: string, onMessage: (msg: Message) => void) {
        console.log('[chat] subscribing to messages for match:', matchId);
        const channel = supabase
            .channel(`messages:${matchId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `match_id=eq.${matchId}`,
            }, (payload) => {
                console.log('[chat] new message received:', payload.new);
                onMessage(payload.new as Message);
            })
            .subscribe((status) => {
                console.log('[chat] subscription status:', status);
            });

        return () => supabase.removeChannel(channel);
    },

    subscribeToTyping(matchId: string, userId: string, onTyping: (uid: string, typing: boolean) => void) {
        const channel = supabase
            .channel(`typing:${matchId}`)
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.userId !== userId) {
                    onTyping(payload.userId as string, payload.isTyping as boolean);
                }
            })
            .subscribe();

        return {
            sendTyping: (isTyping: boolean) => {
                channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping } });
            },
            unsubscribe: () => supabase.removeChannel(channel),
        };
    },
};
