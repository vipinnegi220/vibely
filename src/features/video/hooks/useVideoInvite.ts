import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
    // Keep a ref to the subscribed channel so send/respond reuse it
    const channelRef = useRef<RealtimeChannel | null>(null);

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
            .subscribe((status) => {
                console.log('[invite] channel status:', status);
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [matchId, userId, onAccepted, onRejected, onInviteReceived]);

    const sendInvite = useCallback(async () => {
        if (!channelRef.current || !userId) return;
        setInviteStatus('pending_sent');
        console.log('[invite] sending video invite');
        await channelRef.current.send({
            type: 'broadcast',
            event: 'video-invite',
            payload: { from: userId },
        });
    }, [userId]);

    const respondToInvite = useCallback(async (accepted: boolean) => {
        if (!channelRef.current || !userId) return;
        setInviteStatus(accepted ? 'accepted' : 'idle');
        console.log('[invite] responding to invite:', accepted);
        await channelRef.current.send({
            type: 'broadcast',
            event: 'video-response',
            payload: { from: userId, accepted },
        });
    }, [userId]);

    const resetInvite = useCallback(() => setInviteStatus('idle'), []);

    return { inviteStatus, sendInvite, respondToInvite, resetInvite };
}
