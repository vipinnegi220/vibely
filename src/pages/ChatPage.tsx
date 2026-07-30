import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    SkipForward, MessageSquare, Video, LogOut, Flag, Moon, Sun, ChevronDown
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { VideoPanel } from '@/features/video/components/VideoPanel';
import { SearchingScreen } from '@/features/matching/components/SearchingScreen';
import { useMatching } from '@/features/matching/hooks/useMatching';
import { useChat } from '@/features/chat/hooks/useChat';
import { useVideo } from '@/features/video/hooks/useVideo';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useTheme } from '@/app/ThemeProvider';
import { moderationService } from '@/features/moderation/services/moderationService';
import { toast } from '@/shared/hooks/useToast';
import { cn } from '@/lib/utils';

export default function ChatPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { theme, setTheme } = useTheme();
    const [showReport, setShowReport] = useState(false);

    const {
        status, match, chatType, setChatType,
        startSearching, stopSearching, skipPartner,
    } = useMatching();

    const partnerId = match
        ? (match.user1_id === user?.id ? match.user2_id : match.user1_id)
        : null;

    const { messages, partnerTyping, sendMessage, notifyTyping, clearMessages } = useChat(
        match?.id ?? null,
        user?.id ?? null
    );

    const { localStream, remoteStream, camOn, micOn, connectionState, toggleCam, toggleMic, stopAll } = useVideo({
        matchId: match?.id ?? null,
        userId: user?.id ?? null,
        partnerId,
        enabled: chatType === 'video' && status === 'connected',
    });

    // Clear messages on new match
    useEffect(() => {
        if (match) clearMessages();
    }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleSkip() {
        stopAll();
        skipPartner();
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
            toast({ title: 'User reported', description: 'They have been blocked.', variant: 'default' });
            handleSkip();
        } catch {
            toast({ title: 'Failed to report', variant: 'destructive' });
        }
        setShowReport(false);
    }

    const isConnected = status === 'connected';
    const isSearching = status === 'searching';

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            {/* Top bar */}
            <header className="h-14 border-b border-border/50 px-4 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button onClick={handleLeave} className="flex items-center gap-1.5 font-bold text-lg">
                        <span className="text-vibely-600">vibely</span>
                    </button>
                    <Badge variant={isConnected ? 'success' : isSearching ? 'vibely' : 'secondary'} className="text-xs">
                        {isConnected ? '● Connected' : isSearching ? '◌ Searching...' : '○ Idle'}
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    {/* Chat type toggle */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <button
                            onClick={() => setChatType('text')}
                            className={cn('px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                                chatType === 'text' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
                        >
                            <MessageSquare className="h-3 w-3" /> Text
                        </button>
                        <button
                            onClick={() => setChatType('video')}
                            className={cn('px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                                chatType === 'video' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
                        >
                            <Video className="h-3 w-3" /> Video
                        </button>
                    </div>

                    {/* Theme toggle */}
                    <Button size="icon-sm" variant="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>

                    <Button size="icon-sm" variant="ghost" onClick={handleLeave}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* Main area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video / Searching / Idle panel */}
                <div className={cn(
                    'flex flex-col transition-all duration-300',
                    chatType === 'video' ? 'flex-1' : 'hidden'
                )}>
                    <AnimatePresence mode="wait">
                        {isSearching ? (
                            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex">
                                <SearchingScreen onCancel={stopSearching} />
                            </motion.div>
                        ) : isConnected ? (
                            <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 p-3">
                                <VideoPanel
                                    localStream={localStream}
                                    remoteStream={remoteStream}
                                    camOn={camOn}
                                    micOn={micOn}
                                    onToggleCam={toggleCam}
                                    onToggleMic={toggleMic}
                                />
                                <p className="text-xs text-center text-muted-foreground mt-1">
                                    WebRTC: {connectionState}
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex items-center justify-center">
                                <div className="text-center space-y-4">
                                    <p className="text-muted-foreground">Ready to connect?</p>
                                    <Button variant="vibely" size="lg" onClick={startSearching}>
                                        <Video className="h-5 w-5 mr-2" /> Start Video Chat
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Text-only idle/searching */}
                {chatType === 'text' && !isConnected && (
                    <div className="flex-1 flex items-center justify-center">
                        {isSearching ? (
                            <SearchingScreen onCancel={stopSearching} />
                        ) : (
                            <div className="text-center space-y-4">
                                <p className="text-muted-foreground">Ready to chat?</p>
                                <Button variant="vibely" size="lg" onClick={startSearching}>
                                    <MessageSquare className="h-5 w-5 mr-2" /> Start Text Chat
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Chat sidebar (always visible when connected, or full-width in text mode) */}
                <AnimatePresence>
                    {isConnected && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={cn(
                                'flex flex-col border-l border-border bg-card',
                                chatType === 'video' ? 'w-80 shrink-0' : 'flex-1'
                            )}
                        >
                            {/* Chat header */}
                            <div className="h-12 px-3 border-b border-border flex items-center justify-between shrink-0">
                                <span className="text-sm font-medium">Stranger</span>
                                <div className="flex items-center gap-1">
                                    {/* Report */}
                                    <div className="relative">
                                        <Button size="icon-sm" variant="ghost" onClick={() => setShowReport((v) => !v)}>
                                            <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                                        </Button>
                                        <AnimatePresence>
                                            {showReport && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-lg p-3 w-44 space-y-2"
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
                                    <Button size="icon-sm" variant="ghost" onClick={handleSkip} title="Next person">
                                        <SkipForward className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon-sm" variant="ghost" onClick={() => setShowReport(false)}>
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Chat body */}
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
            </div>

            {/* Bottom action bar */}
            {isConnected && (
                <div className="h-14 border-t border-border/50 px-4 flex items-center justify-center gap-3 shrink-0 bg-background/80">
                    <Button variant="outline" size="sm" onClick={handleSkip} className="gap-2">
                        <SkipForward className="h-4 w-4" /> Next
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleLeave} className="gap-2">
                        <LogOut className="h-4 w-4" /> Leave
                    </Button>
                </div>
            )}
        </div>
    );
}
