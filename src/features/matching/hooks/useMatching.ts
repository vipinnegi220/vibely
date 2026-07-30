import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { matchingService } from '../services/matchingService';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { Match, ConnectionStatus, ChatType } from '@/shared/types';

interface UseMatchingReturn {
    status: ConnectionStatus;
    match: Match | null;
    chatType: ChatType;
    setChatType: (t: ChatType) => void;
    startSearching: () => void;
    stopSearching: () => void;
    skipPartner: () => void;
}

export function useMatching(): UseMatchingReturn {
    const { user } = useAuthStore();
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [match, setMatch] = useState<Match | null>(null);
    const [chatType, setChatType] = useState<ChatType>('video');

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const activeRef = useRef(false);

    const cleanup = useCallback(() => {
        activeRef.current = false;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    }, []);

    const handleMatch = useCallback((newMatch: Match) => {
        if (!activeRef.current) return;
        console.log('[matching] connected:', newMatch.id);
        cleanup();
        setMatch(newMatch);
        setStatus('connected');
    }, [cleanup]);

    const startSearching = useCallback(async () => {
        if (!user) return;
        cleanup();
        activeRef.current = true;
        setStatus('searching');
        setMatch(null);

        try {
            const channel = supabase
                .channel(`match-listen:${user.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' },
                    (payload) => {
                        const m = payload.new as Match;
                        console.log('[matching] realtime INSERT received:', m.id, 'user1:', m.user1_id, 'user2:', m.user2_id, 'me:', user.id);
                        if (m.user1_id === user.id || m.user2_id === user.id) {
                            handleMatch(m);
                        }
                    })
                .subscribe((s) => console.log('[matching] realtime status:', s));

            realtimeRef.current = channel;

            await matchingService.joinQueue(user.id, chatType);

            pollRef.current = setInterval(async () => {
                if (!activeRef.current) return;

                // Always check for an existing active match first (covers Device A)
                const existing = await matchingService.getActiveMatch(user.id);
                console.log('[matching] existing match:', existing?.id ?? 'none');
                if (existing && activeRef.current) {
                    handleMatch(existing);
                    return;
                }

                // Then try to create one (covers Device B)
                const found = await matchingService.tryMatch(user.id, chatType);
                if (found && activeRef.current) {
                    handleMatch(found);
                }
            }, 2000);

        } catch (err) {
            console.error('[matching] error:', err);
            if (activeRef.current) setStatus('error');
        }
    }, [user, chatType, cleanup, handleMatch]);

    const stopSearching = useCallback(async () => {
        if (!user) return;
        cleanup();
        await matchingService.leaveQueue(user.id);
        setStatus('idle');
        setMatch(null);
    }, [user, cleanup]);

    const skipPartner = useCallback(async () => {
        if (!user || !match) return;
        cleanup();
        await matchingService.endMatch(match.id);
        setMatch(null);
        startSearching();
    }, [user, match, cleanup, startSearching]);

    useEffect(() => () => cleanup(), [cleanup]);

    return { status, match, chatType, setChatType, startSearching, stopSearching, skipPartner };
}
