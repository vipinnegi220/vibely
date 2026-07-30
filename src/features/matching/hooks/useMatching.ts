import { useState, useCallback, useRef, useEffect } from 'react';
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

    const unsubRef = useRef<(() => void) | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const activeRef = useRef(false); // prevent state updates after stop

    const cleanup = useCallback(() => {
        activeRef.current = false;
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    const handleMatch = useCallback((newMatch: Match) => {
        if (!activeRef.current) return;
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
            // Subscribe to incoming match notifications BEFORE joining queue
            unsubRef.current = matchingService.subscribeToMatches(user.id, handleMatch);

            // Join the queue
            await matchingService.joinQueue(user.id, chatType);

            // Poll every 2s — try to match with whoever is already waiting
            pollRef.current = setInterval(async () => {
                if (!activeRef.current) return;

                const found = await matchingService.tryMatch(user.id, chatType);
                if (found && activeRef.current) {
                    // Notify the partner (user1) via broadcast
                    await matchingService.notifyMatch(found.user1_id, found);
                    handleMatch(found);
                }
            }, 2000);

        } catch {
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
