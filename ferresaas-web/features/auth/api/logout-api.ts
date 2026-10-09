import { api } from '@/lib/api';

/**
 * Cierra la sesión en el servidor (revoca la sesión en PostgreSQL y limpia
 * la cookie refresh). Usa el transporte común: aporta CSRF/Authorization.
 * El endpoint nunca devuelve 401 por ausencia de sesión, por lo que no
 * participa del flujo de renovación.
 */
export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout', {});
}
