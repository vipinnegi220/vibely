import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './ThemeProvider';
import { AppRouter } from './Router';
import { Toaster } from '@/shared/components/ui/toaster';
import { useAuthInit } from '@/features/auth/hooks/useAuth';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
        },
    },
});

function AuthInitializer({ children }: { children: React.ReactNode }) {
    useAuthInit();
    return <>{children}</>;
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <BrowserRouter>
                    <AuthInitializer>
                        <AppRouter />
                        <Toaster />
                    </AuthInitializer>
                </BrowserRouter>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
