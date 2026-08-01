import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    SkipForward, MessageSquare, Video, LogOut, Flag,
    Moon, Sun, VideoOff, X, Check, Mic,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { VideoPanel } from '@/features/video/components/VideoPanel';
import { SearchingScreen } from '@/features/matching/components/SearchingScreen';
import { useMatching } from '@/features/matching/hooks/useMatching';
import { useChatTypeSwitch } from '@/features/matching/hooks/useChatTypeSwitch';
import { useChat } from '@/features/chat/hooks/useChat';
import { useVideo } from '@/features/video/hooks/useVideo';
import { useVideoInvite } from '@/features/video/hooks/useVideoInvite';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useTheme } from '@/app/ThemeProvider';
import { moderationService } from '@/features/moderation/services/moderationService';
import { toast } from '@/shared/hooks/useToast';
import { cn } from '@/lib/utils';
import type { ChatType } from '@/shared/types';

const CHAT_MODES: { type: ChatType; icon: typeof Video; label: string }[] = [
    { type: 'text', icon: MessageSquare, label: 'Text' },
    { type: 'audio', icon: Mic, label: 'Audio' },
    { type: 'video', icon: Video, label: 'Video' },
];

export default function ChatPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { theme, setTheme } = useTheme();
    const [showReport, setShowReport] = useState(false);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);

    const {
        status, match, chatType, setChatType,
        startSearching, stopSearching, skipPartner,
    } = useMatching();

    const partnerId = match
        ? (match.user1_id === user?.id ? match.user2_id : match.user1_id)
        : null;

    const isConnected = status === 'connected';
    const isSearching = status === 'searching';

    // Listen for partner switching chat type
    const handlePartnerTypeSwitch = useCallback((newType: ChatType) => {
        toast({ title: `Partner switched to ${newType} mode` });
        setChatType(newType);
        setVideoEnabled(newType === 'video');
        setAudioEnabled(newType === 'audio' || newType === 'video');
    }, [setChatType]);

    const { switchType } = useChatTypeSwitch({
        matchId: match?.id ?? null,
        userId: user?.id ?? null,
        onPartnerSwitched: handlePartnerTypeSwitch,
    });

    const { messages, partnerTyping, sendMessage, notifyTyping, clearMessages } = useChat(
        match?.id ?? null,
        user?.id ?? null
    );

    const { localStream, remoteStream, camOn, micOn, connectionState, toggleCam, toggleMic, stopAll } = useVideo({
        matchId: match?.id ?? null,
        userId: user?.id ?? null,
        partnerId,
        enabled: (videoEnabled || audioEnabled) && isConnected,
    });

    const { inviteStatus, sendInvite, respondToInvite, resetInvite } = useVideoInvite({
        matchId: match?.id ?? null,
        userId: user?.id ?? null,
        onAccepted: useCallback(() => {
            setVideoEnabled(true);
            setAudioEnabled(true);
            toast({ title: 'Video call accepted!' });
        }, []),
        onRejected: useCallback(() => {
            setVideoEnabled(false);
            setChatType('text');
            toast({ title: 'Video call declined', variant: 'destructive' });
        }, [setChatType]),
        onInviteReceived: useCallback(() => { }, []),
    });

    useEffect(() => {
        if (match) {
            clearMessages();
            setVideoEnabled(chatType === 'video');
            setAudioEnabled(chatType === 'audio' || chatType === 'video');
            resetInvite();
        }
    }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Switch chat type during a live session
    async function handleTypeSwitch(newType: ChatType) {
        if (!isConnected) {
            setChatType(newType);
            return;
        }

        if (newType === 'video' && chatType !== 'video') {
            // Stop any existing video/audio first
            stopAll();
            setVideoEnabled(false);
            setAudioEnabled(false);
            setChatType('video');
            sendInvite();
            await switchType('video');
            return;
        }

        if (newType === 'audio' && chatType !== 'audio') {
            stopAll();
            setVideoEnabled(false);
            setChatType('audio');
            setAudioEnabled(true);
            await switchType('audio');
            toast({ title: 'Switched to audio mode' });
            return;
        }

        // Text — stop all media
        stopAll();
        setVideoEnabled(false);
        setAudioEnabled(false);
        setChatType('text');
        resetInvite();
        await switchType('text');
        toast({ title: 'Switched to text mode' });
    }

    function handleSkip() {
        stopAll();
        skipPartner();
        setVideoEnabled(false);
        setAudioEnabled(false);
        resetInvite();
    }

    function handleLeave() {
        stopAll();
        stopSearching();
        navigate('/');
    }

    async function handleReport() {
        if (!user || !partnerId) return;
        try {
            await moderationService.reportUser(user.id, partnerId, 'inappropriate');
            await moderationService.blockUser(user.id, partnerId);
            toast({ title: 'User reported & blocked' });
            handleSkip();
        } catch {
            toast({ title: 'Failed to report', variant: 'destructive' });
        }
        setShowReport(false);
    }

    const showVideo = videoEnabled && isConnected &&
        (inviteStatus === 'accepted' || (inviteStatus === 'idle' && chatType === 'video'));

    return (
        <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">

            {/* Top Bar */}
            <header className="h-14 border-b border-border/50 px-3 flex items-center justify-between shrink-0 bg-background/90 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2">
                    <button onClick={handleLeave} className="font-bold text-lg text-vibely-600 tracking-tight">
                        vibely
                    </button>
                    <Badge
                        variant={isConnected ? 'success' : isSearching ? 'vibely' : 'secondary'}
                        className="text-[10px] px-1.5 py-0.5"
                    >
                        {isConnected ? '● Live' : isSearching ? '◌ Searching' : '○ Idle'}
                    </Badge>
                </div>

                <div className="flex items-center gap-1">
                    {/* Mode selector — always visible */}
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
                        {CHAT_MODES.map(({ type, icon: Icon, label }) => (
                            <button
                                key={type}
                                onClick={() => handleTypeSwitch(type)}
                                className={cn(
                                    'px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                                    chatType === type
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Icon className="h-3 w-3" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>

                    <Button size="icon-sm" variant="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={handleLeave}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden relative">

                {/* NOT CONNECTED */}
                <AnimatePresence mode="wait">
                    {!isConnected && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col"
                        >
                            {isSearching ? (
                                <SearchingScreen onCancel={stopSearching} />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                                    <div className="text-center mb-2">
                                        <h2 className="text-2xl font-bold mb-1">Meet someone new</h2>
                                        <p className="text-muted-foreground text-sm">Choose a mode and start chatting</p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                                        {CHAT_MODES.map(({ type, icon: Icon, label }) => (
                                            <Button
                                                key={type}
                                                variant={chatType === type ? 'vibely' : 'outline'}
                                                size="lg"
                                                className="flex-1 gap-2"
                                                onClick={() => startSearching(type)}
                                            >
                                                <Icon className="h-5 w-5" /> {label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONNECTED */}
                <AnimatePresence>
                    {isConnected && (
                        <motion.div
                            key="connected"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            {/* Video area */}
                            <AnimatePresence>
                                {showVideo && (
                                    <motion.div
                                        key="video"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="shrink-0 overflow-hidden"
                                    >
                                        <div className="relative bg-zinc-900" style={{ height: 'min(45vw, 240px)' }}>
                                            <VideoPanel
                                                localStream={localStream}
                                                remoteStream={remoteStream}
                                                camOn={camOn}
                                                micOn={micOn}
                                                onToggleCam={toggleCam}
                                                onToggleMic={toggleMic}
                                            />
                                            <div className="absolute bottom-12 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
                                                {connectionState}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Audio-only indicator */}
                            <AnimatePresence>
                                {audioEnabled && !videoEnabled && isConnected && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="shrink-0 bg-vibely-600/10 border-b border-vibely-600/20 px-4 py-2 flex items-center gap-2"
                                    >
                                        <Mic className="h-4 w-4 text-vibely-600 animate-pulse" />
                                        <span className="text-sm text-vibely-600 font-medium">Audio call active</span>
                                        <span className="text-xs text-muted-foreground ml-auto">{connectionState}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Chat header */}
                            <div className="h-10 px-3 border-b border-border/50 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Stranger</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5">
                                        {chatType}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="relative">
                                        <Button size="icon-sm" variant="ghost" onClick={() => setShowReport(v => !v)}>
                                            <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                        <AnimatePresence>
                                            {showReport && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                    className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl p-3 w-44 space-y-2"
                                                >
                                                    <p className="text-xs font-medium">Report this user?</p>
                                                    <Button size="sm" variant="destructive" className="w-full text-xs" onClick={handleReport}>
                                                        Report & Block
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => setShowReport(false)}>
                                                        Cancel
                                                    </Button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <Button size="icon-sm" variant="ghost" onClick={handleSkip} title="Next">
                                        <SkipForward className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-hidden">
                                <ChatPanel
                                    messages={messages}
                                    userId={user?.id ?? ''}
                                    partnerTyping={partnerTyping}
                                    onSend={sendMessage}
                                    onTyping={notifyTyping}
                                    disabled={!isConnected}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Video invite — incoming */}
                <AnimatePresence>
                    {inviteStatus === 'pending_received' && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            className="absolute inset-x-0 bottom-20 mx-auto w-full max-w-sm px-4 z-50"
                        >
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-2xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-full bg-vibely-600/10 flex items-center justify-center">
                                        <Video className="h-5 w-5 text-vibely-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">Video call request</p>
                                        <p className="text-xs text-muted-foreground">Stranger wants to video chat</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button className="flex-1 gap-1.5" variant="vibely" size="sm" onClick={() => respondToInvite(true)}>
                                        <Check className="h-4 w-4" /> Accept
                                    </Button>
                                    <Button className="flex-1 gap-1.5" variant="outline" size="sm" onClick={() => respondToInvite(false)}>
                                        <X className="h-4 w-4" /> Decline
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Video invite — waiting */}
                <AnimatePresence>
                    {inviteStatus === 'pending_sent' && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            className="absolute inset-x-0 bottom-20 mx-auto w-full max-w-sm px-4 z-50"
                        >
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-xl flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-vibely-600/10 flex items-center justify-center animate-pulse">
                                    <Video className="h-4 w-4 text-vibely-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Waiting for response...</p>
                                    <p className="text-xs text-muted-foreground">Video call request sent</p>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => { resetInvite(); setChatType('text'); }}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Video invite — rejected */}
                <AnimatePresence>
                    {inviteStatus === 'rejected' && (
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            className="absolute inset-x-0 bottom-20 mx-auto w-full max-w-sm px-4 z-50"
                        >
                            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 shadow-xl flex items-center gap-3">
                                <VideoOff className="h-5 w-5 text-destructive shrink-0" />
                                <p className="text-sm font-medium text-destructive">Video call was declined</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Bottom Action Bar */}
            <AnimatePresence>
                {isConnected && (
                    <motion.div
                        initial={{ y: 60 }}
                        animate={{ y: 0 }}
                        exit={{ y: 60 }}
                        className="h-14 border-t border-border/50 px-4 flex items-center justify-center gap-3 shrink-0 bg-background/90 backdrop-blur-sm safe-bottom"
                    >
                        <Button variant="outline" size="sm" onClick={handleSkip} className="gap-1.5 h-9">
                            <SkipForward className="h-4 w-4" /> Next
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleLeave} className="gap-1.5 h-9">
                            <LogOut className="h-4 w-4" /> Leave
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
