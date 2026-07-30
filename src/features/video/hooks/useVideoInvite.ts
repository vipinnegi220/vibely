import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type InviteStatus = 'idle' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';

interface UseVideoInviteOptions {
    matchId: string | null;
    userId: string | null;
    onAccepted: () => void;
    onRejected: () => void;
    onInviteReceived: () => void;
}

export function useVideoInvite({
    matchId,
    userId,
    onAccepted,
    onRejected,
    onInviteReceived,
}: UseVideoInviteOptions) {
    const [inviteStatus, setInviteStatus] = useState<InviteStatus>('idle');

    useEffect(() => {
        if (!matchId || !userId) return;

        const channel = supabase
            .channel(`video-invite:${matchId}`)
            .on('broadcast', { event: 'video-invite' }, ({ payload }) => {
                if (payload.from !== userId) {
                    setInviteStatus('pending_received');
                    onInviteReceived();
                }
            })
            .on('broadcast', { event: 'video-response' }, ({ payload }) => {
                if (payload.from !== userId) {
                    if (payload.accepted) {
                        setInviteStatus('accepted');
                        onAccepted();
                    } else {
                        setInviteStatus('rejected');
                        onRejected();
                        setTimeout(() => setInviteStatus('idle'), 3000);
                    }
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [matchId, userId, onAccepted, onRejected, onInviteReceived]);

    const sendInvite = useCallback(async () => {
        if (!matchId || !userId) return;
        setInviteStatus('pending_sent');
        await supabase.channel(`video-invite:${matchId}`).send({
            type: 'broadcast',
            event: 'video-invite',
            payload: { from: userId },
        });
    }, [matchId, userId]);

    const respondToInvite = useCallback(async (accepted: boolean) => {
        if (!matchId || !userId) return;
        setInviteStatus(accepted ? 'accepted' : 'idle');
        await supabase.channel(`video-invite:${matchId}`).send({
            type: 'broadcast',
            event: 'video-response',
            payload: { from: userId, accepted },
        });
    }, [matchId, userId]);

    const resetInvite = useCallback(() => setInviteStatus('idle'), []);

    return { inviteStatus, sendInvite, respondToInvite, resetInvite };
}
