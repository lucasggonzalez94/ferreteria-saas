import { QueryClient } from '@tanstack/react-query';
import { destroySessionCaches, registerQueryClient } from '@/lib/session-cleanup';

describe('session-cleanup (aislamiento de tenant en el navegador)', () => {
  it('clears TanStack Query cache when a query client is registered', async () => {
    const client = new QueryClient();
    client.setQueryData(['products'], [{ id: 'p1' }]);
    registerQueryClient(client);
    destroySessionCaches();
    expect(client.getQueryData(['products'])).toBeUndefined();
  });

  it('removes tenant-scoped data from storage', () => {
    sessionStorage.setItem('pos_cart_session', '[]');
    sessionStorage.setItem('pendingPurchaseAttachments', '{}');
    localStorage.setItem('dashboardQuickActionsPrefs', '{}');
    localStorage.setItem('command-palette-recent-actions', '[]');
    destroySessionCaches();
    expect(sessionStorage.getItem('pos_cart_session')).toBeNull();
    expect(sessionStorage.getItem('pendingPurchaseAttachments')).toBeNull();
    expect(localStorage.getItem('dashboardQuickActionsPrefs')).toBeNull();
    expect(localStorage.getItem('command-palette-recent-actions')).toBeNull();
  });
});
