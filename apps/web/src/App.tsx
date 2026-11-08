import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { HighlightProvider } from '@/lib/highlight';
import { Dashboard } from '@/routes/Dashboard';
import { NotFound } from '@/routes/NotFound';
import { Settings } from '@/routes/Settings';
import { Trips } from '@/routes/Trips';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HighlightProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="trips" element={<Trips />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </HighlightProvider>
    </QueryClientProvider>
  );
}
