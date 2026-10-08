import type { QueryClient } from '@tanstack/react-query';

let queryClientRef: QueryClient | null = null;

/** Registrado por providers.tsx al montar. */
export function registerQueryClient(client: QueryClient): void {
  queryClientRef = client;
}

/**
 * Limpieza de contexto al cambiar de sesión/tenant (login, signup, logout):
 * ningún dato del usuario anterior puede sobrevivir en este navegador.
 */
export function destroySessionCaches(): void {
  queryClientRef?.clear();

  if (typeof window === 'undefined') return;
  try {
    // Estado persistido del tenant anterior.
    sessionStorage.removeItem('pos_cart_session');
    sessionStorage.removeItem('pendingPurchaseAttachments');

    // Preferencias visuales ligadas a identidad/tenant.
    localStorage.removeItem('dashboardQuickActionsPrefs');
    localStorage.removeItem('dashboardQuickActions');
    localStorage.removeItem('command-palette-recent-actions');
  } catch {
    // Storage no disponible (modo privado): nada que hacer.
  }
}
