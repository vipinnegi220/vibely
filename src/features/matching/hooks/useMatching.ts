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
    const disconnectRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // "searching" = currently in queue looking for match
    // "intentional_stop" = user manually left, don't auto-restart
    const searchingRef = useRef(false);
    const currentMatchIdRef = useRef<string | null>(null);
    const chatTypeRef = useRef<ChatType>('video');
    useEffect(() => { chatTypeRef.current = chatType; }, [chatType]);

    const stopPoll = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    const stopRealtime = useCallback(() => {
        if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    }, []);

    const stopDisconnectListener = useCallback(() => {
        if (disconnectRef.current) { supabase.removeChannel(disconnectRef.current); disconnectRef.current = null; }
    }, []);

    // Watch for partner ending the match
    const listenForPartnerDisconnect = useCallback((matchId: string, restartSearch: () => void) => {
        stopDisconnectListener();
        const ch = supabase
            .channel(`match-end:${matchId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'matches',
                filter: `id=eq.${matchId}`,
            }, (payload) => {
                const updated = payload.new as Match;
                if (updated.status === 'ended' && currentMatchIdRef.current === matchId) {
                    console.log('[matching] partner disconnected');
                    stopDisconnectListener();
                    currentMatchIdRef.current = null;
                    setMatch(null);
                    setStatus('idle');
                    setTimeout(() => {
                        if (searchingRef.current) restartSearch();
                    }, 1000);
                }
            })
            .subscribe();
        disconnectRef.current = ch;
    }, [stopDisconnectListener]);

    const handleMatch = useCallback((newMatch: Match, restartFn: () => void) => {
        console.log('[matching] connected to match:', newMatch.id);
        // Stop searching machinery but keep searchingRef true so disconnect can restart
        stopPoll();
        stopRealtime();
        currentMatchIdRef.current = newMatch.id;
        setMatch(newMatch);
        setStatus('connected');
        listenForPartnerDisconnect(newMatch.id, restartFn);
    }, [stopPoll, stopRealtime, listenForPartnerDisconnect]);

    const startSearching = useCallback(async () => {
        if (!user) return;

        // Stop any existing search/connection
        stopPoll();
        stopRealtime();
        stopDisconnectListener();
        currentMatchIdRef.current = null;
        searchingRef.current = true;
        setStatus('searching');
        setMatch(null);

        // Capture a stable reference for restart callbacks
        const restart = () => startSearching();

        try {
            // Realtime: catches match INSERT immediately
            const channel = supabase
                .channel(`match-listen:${user.id}-${Date.now()}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' },
                    (payload) => {
                        if (!searchingRef.current) return;
                        const m = payload.new as Match;
                        if (m.user1_id === user.id || m.user2_id === user.id) {
                            handleMatch(m, restart);
                        }
                    })
                .subscribe((s) => console.log('[matching] realtime:', s));

            realtimeRef.current = channel;

            await matchingService.joinQueue(user.id, chatTypeRef.current);

            // Poll every 2s as reliable fallback
            pollRef.current = setInterval(async () => {
                if (!searchingRef.current) return;

                // Check if someone matched us (Device A scenario)
                const existing = await matchingService.getActiveMatch(user.id);
                if (existing && searchingRef.current) {
                    handleMatch(existing, restart);
                    return;
                }

                // Try to match with someone waiting (Device B scenario)
                const found = await matchingService.tryMatch(user.id, chatTypeRef.current);
                if (found && searchingRef.current) {
                    handleMatch(found, restart);
                }
            }, 2000);

        } catch (err) {
            console.error('[matching] error:', err);
            if (searchingRef.current) setStatus('error');
        }
    }, [user, stopPoll, stopRealtime, stopDisconnectListener, handleMatch]);

    const stopSearching = useCallback(async () => {
        if (!user) return;
        searchingRef.current = false;
        stopPoll();
        stopRealtime();
        stopDisconnectListener();
        const matchId = currentMatchIdRef.current;
        currentMatchIdRef.current = null;
        if (matchId) await matchingService.endMatch(matchId);
        await matchingService.leaveQueue(user.id);
        setStatus('idle');
        setMatch(null);
    }, [user, stopPoll, stopRealtime, stopDisconnectListener]);

    const skipPartner = useCallback(async () => {
        if (!user) return;
        const matchId = currentMatchIdRef.current;
        stopPoll();
        stopRealtime();
        stopDisconnectListener();
        currentMatchIdRef.current = null;
        if (matchId) await matchingService.endMatch(matchId);
        setMatch(null);
        // searchingRef stays true — we want to re-search
        startSearching();
    }, [user, stopPoll, stopRealtime, stopDisconnectListener, startSearching]);

    useEffect(() => {
        const handleUnload = () => {
            if (user) matchingService.leaveQueue(user.id);
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            searchingRef.current = false;
            stopPoll();
            stopRealtime();
            stopDisconnectListener();
        };
    }, [user, stopPoll, stopRealtime, stopDisconnectListener]);

    return { status, match, chatType, setChatType, startSearching, stopSearching, skipPartner };
}
