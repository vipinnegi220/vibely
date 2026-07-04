import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const moderationService = {
    async reportUser(reporterId: string, reportedId: string, reason: string, details?: string) {
        const { error } = await db.from('reports').insert({
            reporter_id: reporterId,
            reported_id: reportedId,
            reason,
            details: details ?? null,
        });
        if (error) throw error;
    },

    async blockUser(blockerId: string, blockedId: string) {
        const { error } = await db.from('blocks').upsert({
            blocker_id: blockerId,
            blocked_id: blockedId,
        });
        if (error) throw error;
    },
};
