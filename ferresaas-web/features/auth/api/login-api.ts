import { api } from '@/lib/api';
import type { LoginResponse } from '../model/login-types';

export async function loginRequest(input: { email: string; password: string }): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', input);
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Login failed');
  }
  return response.data;
}
