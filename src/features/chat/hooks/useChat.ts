import { useState, useEffect, useRef, useCallback } from 'react';
import { chatService } from '../services/chatService';
import type { Message } from '@/shared/types';

export function useChat(matchId: string | null, userId: string | null) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingChannelRef = useRef<{ sendTyping: (t: boolean) => void; unsubscribe: () => void } | null>(null);

    // Load history + subscribe when match starts
    useEffect(() => {
        if (!matchId || !userId) return;

        chatService.getMessages(matchId).then(setMessages);

        const unsubMessages = chatService.subscribeToMessages(matchId, (msg) => {
            setMessages((prev) => {
                if (prev.find((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        });

        const typing = chatService.subscribeToTyping(matchId, userId, (_uid, isTyping) => {
            setPartnerTyping(isTyping);
            if (isTyping) {
                if (typingRef.current) clearTimeout(typingRef.current);
                typingRef.current = setTimeout(() => setPartnerTyping(false), 3000);
            }
        });
        typingChannelRef.current = typing;

        return () => {
            unsubMessages();
            typing.unsubscribe();
            if (typingRef.current) clearTimeout(typingRef.current);
        };
    }, [matchId, userId]);

    const sendMessage = useCallback(async (content: string) => {
        if (!matchId || !userId || !content.trim()) return;
        await chatService.sendMessage(matchId, userId, content);
    }, [matchId, userId]);

    const notifyTyping = useCallback((isTyping: boolean) => {
        typingChannelRef.current?.sendTyping(isTyping);
    }, []);

    const clearMessages = useCallback(() => setMessages([]), []);

    return { messages, partnerTyping, sendMessage, notifyTyping, clearMessages };
}
