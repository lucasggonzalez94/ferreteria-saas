import { api } from '@/lib/api';
import type { SignupRequest, SignupResponse } from '../model/signup-types';

export async function signupRequest(payload: SignupRequest): Promise<SignupResponse> {
  const response = await api.post<SignupResponse>('/auth/signup', payload);
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Signup failed');
  }
  return response.data;
}
