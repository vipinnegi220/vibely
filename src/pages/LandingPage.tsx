import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, Shield, Globe, Video, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { authService } from '@/features/auth/services/authService';
import { toast } from '@/shared/hooks/useToast';
import { useState } from 'react';

const features = [
    { icon: Video, title: 'HD Video Chat', desc: 'Crystal-clear video with WebRTC technology' },
    { icon: MessageCircle, title: 'Instant Messaging', desc: 'Real-time text chat with emoji support' },
    { icon: Globe, title: 'Global Reach', desc: 'Connect with people from around the world' },
    { icon: Shield, title: 'Safe & Secure', desc: 'Anonymous by default with moderation tools' },
    { icon: Zap, title: 'Instant Match', desc: 'Get matched with someone new in seconds' },
    { icon: Users, title: 'Interest Matching', desc: 'Find people who share your interests' },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState<string | null>(null);

    async function handleGuest() {
        setLoading('guest');
        try {
            await authService.signInAsGuest();
            navigate('/chat');
        } catch {
            toast({ title: 'Failed to start', description: 'Please try again.', variant: 'destructive' });
        } finally {
            setLoading(null);
        }
    }

    async function handleGoogle() {
        setLoading('google');
        try {
            await authService.signInWithGoogle();
        } catch {
            toast({ title: 'Google sign-in failed', variant: 'destructive' });
            setLoading(null);
        }
    }

    async function handleAnonymous() {
        setLoading('anon');
        try {
            await authService.signInAnonymously();
            navigate('/chat');
        } catch {
            toast({ title: 'Failed to sign in', variant: 'destructive' });
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="relative min-h-screen flex flex-col overflow-hidden">

            {/* ── Full-screen background video ── */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                >
                    <source src="/forbackground.mp4" type="video/mp4" />
                </video>
                {/* Dark overlay so text is readable — 65% opacity */}
                <div className="absolute inset-0 bg-background/65" />
            </div>

            {/* ── Nav ── */}
            <nav className="border-b border-border/30 backdrop-blur-sm sticky top-0 z-50 bg-background/40">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-vibely-600 flex items-center justify-center shadow-lg shadow-vibely-600/30">
                            <Zap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight">vibely</span>
                    </div>
                    <Button variant="vibely" size="sm" onClick={handleGuest} disabled={loading !== null}>
                        Start chatting
                    </Button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <main className="flex-1">
                <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Badge variant="vibely" className="mb-6">
                            Free to use · No account required
                        </Badge>
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
                            Meet new people,{' '}
                            <span className="text-vibely-600">instantly</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                            Random video and text chat with strangers worldwide. Filter by interests, stay
                            anonymous, and connect in seconds.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                                size="xl"
                                variant="vibely"
                                onClick={handleGuest}
                                disabled={loading !== null}
                                className="gap-2"
                            >
                                <Video className="h-5 w-5" />
                                {loading === 'guest' ? 'Starting...' : 'Start Video Chat'}
                            </Button>
                            <Button
                                size="xl"
                                variant="outline"
                                onClick={handleAnonymous}
                                disabled={loading !== null}
                                className="backdrop-blur-sm bg-background/30"
                            >
                                {loading === 'anon' ? 'Starting...' : 'Text Chat Only'}
                            </Button>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">
                            Or{' '}
                            <button
                                onClick={handleGoogle}
                                disabled={loading !== null}
                                className="text-vibely-600 hover:underline font-medium"
                            >
                                sign in with Google
                            </button>{' '}
                            to save your preferences
                        </p>
                    </motion.div>

                    {/* ── Preview video ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="mt-16 relative"
                    >
                        <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-2 shadow-2xl shadow-vibely-600/10 max-w-3xl mx-auto overflow-hidden">
                            <div className="rounded-xl overflow-hidden aspect-video relative">
                                <video
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover"
                                >
                                    <source src="/preview.mp4" type="video/mp4" />
                                </video>
                                {/* Subtle overlay to blend with card */}
                                <div className="absolute inset-0 bg-black/10" />
                            </div>
                        </div>
                        {/* Glow */}
                        <div className="absolute -inset-4 -z-10 bg-vibely-600/8 blur-3xl rounded-full" />
                    </motion.div>
                </section>

                {/* ── Features ── */}
                <section className="max-w-6xl mx-auto px-4 py-16">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {features.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i }}
                                className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-6 hover:bg-card/60 transition-colors"
                            >
                                <div className="h-10 w-10 rounded-xl bg-vibely-600/10 flex items-center justify-center mb-4">
                                    <f.icon className="h-5 w-5 text-vibely-600" />
                                </div>
                                <h3 className="font-semibold mb-1">{f.title}</h3>
                                <p className="text-sm text-muted-foreground">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>
            </main>

            {/* ── Footer ── */}
            <footer className="border-t border-border/30 py-6 text-center text-sm text-muted-foreground backdrop-blur-sm">
                <p>© 2025 Vibely · Connect respectfully · Report abuse</p>
            </footer>
        </div>
    );
}
