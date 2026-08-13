import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';

import { indexRoute } from '../routes/index';
import { loginRoute } from '../routes/login';
import { settingsRoute } from '../routes/settings';
import { trashRoute } from '../routes/trash';
import { rootRoute } from '../routes/__root';

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, settingsRoute, trashRoute]);

interface RenderOptions {
  initialState?: Record<string, unknown>;
  initialUrl?: string;
}

export function renderWithProviders(options: RenderOptions = {}) {
  const { initialState, initialUrl = '/' } = options;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialUrl],
  });
  if (initialState) memoryHistory.replace(initialUrl, initialState);

  const testRouter = createRouter({
    routeTree,
    history: memoryHistory,
  });

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={testRouter as never} />
      </QueryClientProvider>
    );
  }

  return {
    ...render(<App />),
    queryClient,
    router: testRouter,
  };
}
