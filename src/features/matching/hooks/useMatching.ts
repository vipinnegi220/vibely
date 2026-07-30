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
        if (realtimeRef.current) {
            supabase.removeChannel(realtimeRef.current);
            realtimeRef.current = null;
        }
    }, []);

    const handleMatch = useCallback((newMatch: Match) => {
        if (!activeRef.current) return;
        console.log('[matching] connected to match:', newMatch.id);
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
            // Listen for new matches via Postgres realtime (more reliable than broadcast)
            const channel = supabase
                .channel(`match-listen:${user.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'matches',
                }, (payload) => {
                    const newMatch = payload.new as Match;
                    // Only handle matches where this user is involved
                    if (newMatch.user1_id === user.id || newMatch.user2_id === user.id) {
                        handleMatch(newMatch);
                    }
                })
                .subscribe((status) => {
                    console.log('[matching] realtime status:', status);
                });

            realtimeRef.current = channel;

            // Join the queue
            await matchingService.joinQueue(user.id, chatType);

            // Poll to try to create a match with someone already waiting
            pollRef.current = setInterval(async () => {
                if (!activeRef.current) return;
                const found = await matchingService.tryMatch(user.id, chatType);
                if (found && activeRef.current) {
                    handleMatch(found);
                }
            }, 2000);

        } catch (err) {
            console.error('[matching] startSearching error:', err);
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
