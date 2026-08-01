import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoPanelProps {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    camOn: boolean;
    micOn: boolean;
    onToggleCam: () => void;
    onToggleMic: () => void;
    className?: string;
}

function VideoEl({ stream, muted = false, className }: {
    stream: MediaStream | null;
    muted?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && stream) ref.current.srcObject = stream;
    }, [stream]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            className={cn('w-full h-full object-cover', className)}
        />
    );
}

export function VideoPanel({
    localStream, remoteStream, camOn, micOn,
    onToggleCam, onToggleMic, className,
}: VideoPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    return (
        <div
            ref={containerRef}
            className={cn('relative w-full h-full bg-black overflow-hidden', className)}
        >
            {/* Remote video — full screen */}
            {remoteStream ? (
                <VideoEl stream={remoteStream} className="absolute inset-0" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    <div className="text-center text-zinc-500">
                        <Video className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm opacity-40">Waiting for video...</p>
                    </div>
                </div>
            )}

            {/* Gradient overlays for readability */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

            {/* Local video PiP — draggable */}
            <motion.div
                drag
                dragConstraints={containerRef}
                dragElastic={0.1}
                className="absolute top-3 right-3 w-24 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden border border-white/20 shadow-2xl cursor-grab active:cursor-grabbing z-20"
            >
                {camOn && localStream ? (
                    <VideoEl stream={localStream} muted className="scale-x-[-1]" />
                ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <VideoOff className="h-4 w-4 text-zinc-500" />
                    </div>
                )}
                <div className="absolute bottom-1 left-1 text-[9px] text-white/60 bg-black/40 px-1 rounded">You</div>
            </motion.div>

            {/* Controls row at bottom */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-20">
                <Button
                    size="icon"
                    variant={micOn ? 'secondary' : 'destructive'}
                    className="rounded-full h-10 w-10 bg-black/50 hover:bg-black/70 border-white/10 backdrop-blur-sm"
                    onClick={onToggleMic}
                >
                    {micOn ? <Mic className="h-4 w-4 text-white" /> : <MicOff className="h-4 w-4" />}
                </Button>
                <Button
                    size="icon"
                    variant={camOn ? 'secondary' : 'destructive'}
                    className="rounded-full h-10 w-10 bg-black/50 hover:bg-black/70 border-white/10 backdrop-blur-sm"
                    onClick={onToggleCam}
                >
                    {camOn ? <Video className="h-4 w-4 text-white" /> : <VideoOff className="h-4 w-4" />}
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full h-10 w-10 bg-black/50 hover:bg-black/70 border-white/10 backdrop-blur-sm"
                    onClick={toggleFullscreen}
                >
                    {isFullscreen
                        ? <Minimize2 className="h-4 w-4 text-white" />
                        : <Maximize2 className="h-4 w-4 text-white" />}
                </Button>
            </div>
        </div>
    );
}
