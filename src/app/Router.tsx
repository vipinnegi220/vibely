import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/authStore';
import { Skeleton } from '@/shared/components/ui/skeleton';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
    return (
        <div className="min-h-screen bg-background p-8 space-y-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
    );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isInitialized } = useAuthStore();
    if (!isInitialized) return <PageLoader />;
    if (!user) return <Navigate to="/" replace />;
    return <>{children}</>;
}

export function AppRouter() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <ChatPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
}
