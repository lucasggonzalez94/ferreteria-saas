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
