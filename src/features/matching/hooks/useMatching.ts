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
    const matchListenRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const activeRef = useRef(false);
    const currentMatchIdRef = useRef<string | null>(null);
    const chatTypeRef = useRef<ChatType>('video');

    // Keep chatTypeRef in sync
    useEffect(() => { chatTypeRef.current = chatType; }, [chatType]);

    const stopMatchListener = useCallback(() => {
        if (matchListenRef.current) {
            supabase.removeChannel(matchListenRef.current);
            matchListenRef.current = null;
        }
    }, []);

    const cleanup = useCallback(() => {
        activeRef.current = false;
        currentMatchIdRef.current = null;
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
        stopMatchListener();
    }, [stopMatchListener]);

    // Listen for partner disconnecting (match status → ended)
    const listenForDisconnect = useCallback((matchId: string) => {
        stopMatchListener();
        const channel = supabase
            .channel(`match-end:${matchId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matches',
                filter: `id=eq.${matchId}`,
            }, (payload) => {
                const updated = payload.new as Match;
                if (updated.status === 'ended' && currentMatchIdRef.current === matchId) {
                    console.log('[matching] partner disconnected, restarting search');
                    stopMatchListener();
                    currentMatchIdRef.current = null;
                    setMatch(null);
                    setStatus('idle');
                    // Small delay so UI shows disconnected briefly, then auto-search
                    setTimeout(() => {
                        if (activeRef.current === false) {
                            // User manually left — don't auto search
                            return;
                        }
                        startSearchingRef.current?.();
                    }, 1500);
                }
            })
            .subscribe();
        matchListenRef.current = channel;
    }, [stopMatchListener]);

    // Use a ref so listenForDisconnect can call startSearching without circular deps
    const startSearchingRef = useRef<(() => void) | null>(null);

    const handleMatch = useCallback((newMatch: Match) => {
        if (!activeRef.current) return;
        console.log('[matching] connected:', newMatch.id);
        cleanup();
        activeRef.current = true; // keep active for disconnect detection
        currentMatchIdRef.current = newMatch.id;
        setMatch(newMatch);
        setStatus('connected');
        listenForDisconnect(newMatch.id);
    }, [cleanup, listenForDisconnect]);

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
                        if (m.user1_id === user.id || m.user2_id === user.id) {
                            handleMatch(m);
                        }
                    })
                .subscribe((s) => console.log('[matching] realtime:', s));

            realtimeRef.current = channel;

            await matchingService.joinQueue(user.id, chatTypeRef.current);

            pollRef.current = setInterval(async () => {
                if (!activeRef.current) return;

                const existing = await matchingService.getActiveMatch(user.id);
                if (existing && activeRef.current) {
                    handleMatch(existing);
                    return;
                }

                const found = await matchingService.tryMatch(user.id, chatTypeRef.current);
                if (found && activeRef.current) {
                    handleMatch(found);
                }
            }, 2000);

        } catch (err) {
            console.error('[matching] error:', err);
            if (activeRef.current) setStatus('error');
        }
    }, [user, cleanup, handleMatch]);

    // Keep ref in sync for use inside listenForDisconnect callback
    useEffect(() => { startSearchingRef.current = startSearching; }, [startSearching]);

    const stopSearching = useCallback(async () => {
        if (!user) return;
        const wasConnected = !!currentMatchIdRef.current;
        const matchId = currentMatchIdRef.current;
        cleanup();
        activeRef.current = false; // signal we intentionally stopped
        if (wasConnected && matchId) {
            await matchingService.endMatch(matchId);
        }
        await matchingService.leaveQueue(user.id);
        setStatus('idle');
        setMatch(null);
    }, [user, cleanup]);

    const skipPartner = useCallback(async () => {
        if (!user) return;
        const matchId = currentMatchIdRef.current;
        cleanup();
        activeRef.current = true; // stay active — we want to re-search
        if (matchId) {
            await matchingService.endMatch(matchId);
        }
        setMatch(null);
        startSearching();
    }, [user, cleanup, startSearching]);

    useEffect(() => () => {
        cleanup();
        activeRef.current = false;
    }, [cleanup]);

    return { status, match, chatType, setChatType, startSearching, stopSearching, skipPartner };
}
