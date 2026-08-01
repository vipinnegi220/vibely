import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Smile } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn, formatTime } from '@/lib/utils';
import type { Message } from '@/shared/types';

const EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '😎', '🙌', '😅', '🤔', '👋', '✨', '🎉'];

interface ChatPanelProps {
    messages: Message[];
    userId: string;
    partnerTyping: boolean;
    onSend: (text: string) => void;
    onTyping: (isTyping: boolean) => void;
    disabled?: boolean;
    // When true, renders as overlay on top of video
    overlay?: boolean;
}

export function ChatPanel({
    messages, userId, partnerTyping,
    onSend, onTyping, disabled, overlay = false,
}: ChatPanelProps) {
    const [text, setText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, partnerTyping]);

    const handleChange = useCallback((val: string) => {
        setText(val);
        onTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => onTyping(false), 1500);
    }, [onTyping]);

    const handleSend = useCallback(() => {
        if (!text.trim() || disabled) return;
        onSend(text.trim());
        setText('');
        onTyping(false);
        setShowEmoji(false);
    }, [text, disabled, onSend, onTyping]);

    if (overlay) {
        return (
            <div className="flex flex-col h-full">
                {/* Messages — floating with translucent bubbles */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-none">
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => {
                            const isMe = msg.sender_id === userId;
                            return (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                                >
                                    <div
                                        className={cn(
                                            'max-w-[70%] px-3 py-1.5 rounded-2xl text-sm break-words shadow-lg',
                                            isMe
                                                ? 'bg-vibely-600/80 text-white backdrop-blur-sm rounded-br-sm'
                                                : 'bg-black/50 text-white backdrop-blur-sm rounded-bl-sm border border-white/10'
                                        )}
                                    >
                                        <p>{msg.content}</p>
                                        <p className="text-[10px] mt-0.5 text-right text-white/50">
                                            {formatTime(msg.created_at)}
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    <AnimatePresence>
                        {partnerTyping && (
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex justify-start"
                            >
                                <div className="bg-black/50 backdrop-blur-sm px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1 items-center border border-white/10">
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce"
                                            style={{ animationDelay: `${i * 0.15}s` }}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={bottomRef} />
                </div>

                {/* Emoji picker */}
                <AnimatePresence>
                    {showEmoji && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="px-3 pb-1 flex flex-wrap gap-1 bg-black/30 backdrop-blur-sm"
                        >
                            {EMOJIS.map((e) => (
                                <button key={e} onClick={() => setText((t) => t + e)}
                                    className="text-xl hover:scale-125 transition-transform">
                                    {e}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input bar — glass style */}
                <div className="px-3 pb-2 pt-1 flex gap-2 items-center bg-black/30 backdrop-blur-sm">
                    <Button size="icon-sm" variant="ghost" onClick={() => setShowEmoji(v => !v)}
                        className="shrink-0 text-white/70 hover:text-white hover:bg-white/10">
                        <Smile className="h-4 w-4" />
                    </Button>
                    <input
                        value={text}
                        onChange={(e) => handleChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder={disabled ? 'Not connected...' : 'Message...'}
                        disabled={disabled}
                        className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-white/40 backdrop-blur-sm"
                    />
                    <Button
                        size="icon-sm"
                        variant="vibely"
                        onClick={handleSend}
                        disabled={!text.trim() || disabled}
                        className="shrink-0 rounded-full"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // Normal (non-overlay) mode
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        const isMe = msg.sender_id === userId;
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                            >
                                <div className={cn(
                                    'max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words',
                                    isMe
                                        ? 'bg-vibely-600 text-white rounded-br-sm'
                                        : 'bg-muted text-foreground rounded-bl-sm'
                                )}>
                                    <p>{msg.content}</p>
                                    <p className={cn('text-[10px] mt-0.5 text-right',
                                        isMe ? 'text-white/60' : 'text-muted-foreground')}>
                                        {formatTime(msg.created_at)}
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                <AnimatePresence>
                    {partnerTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex justify-start"
                        >
                            <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                                {[0, 1, 2].map((i) => (
                                    <span key={i}
                                        className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                                        style={{ animationDelay: `${i * 0.15}s` }} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={bottomRef} />
            </div>

            <AnimatePresence>
                {showEmoji && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="px-3 pb-2 flex flex-wrap gap-1"
                    >
                        {EMOJIS.map((e) => (
                            <button key={e} onClick={() => setText((t) => t + e)}
                                className="text-xl hover:scale-125 transition-transform">{e}</button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="p-3 border-t border-border flex gap-2 items-center">
                <Button size="icon-sm" variant="ghost" onClick={() => setShowEmoji(v => !v)} className="shrink-0">
                    <Smile className="h-4 w-4" />
                </Button>
                <Input
                    value={text}
                    onChange={(e) => handleChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={disabled ? 'Not connected...' : 'Type a message...'}
                    disabled={disabled}
                    className="flex-1 rounded-xl"
                />
                <Button size="icon-sm" variant="vibely" onClick={handleSend}
                    disabled={!text.trim() || disabled} className="shrink-0 rounded-xl">
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
