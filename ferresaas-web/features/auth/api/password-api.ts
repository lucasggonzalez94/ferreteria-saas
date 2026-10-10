import { api } from '@/lib/api';

interface MessageResponse {
  message: string;
}

export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/forgot-password', { email });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'No pudimos enviar el enlace de recuperación');
  }
  return response.data;
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/reset-password', input);
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'No pudimos restablecer la contraseña');
  }
  return response.data;
}

/**
 * Cambio de contraseña del usuario autenticado. Si tiene éxito, el servidor
 * revoca TODAS las sesiones y limpia la cookie refresh: el caller debe cerrar
 * la sesión local y redirigir a /login.
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>('/auth/change-password', input);
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'No pudimos cambiar la contraseña');
  }
  return response.data;
}
