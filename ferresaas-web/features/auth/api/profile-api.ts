import { api } from '@/lib/api';

export interface ProfileResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  businessId: string;
}

export async function updateProfile(input: {
  firstName: string;
  lastName?: string;
}): Promise<ProfileResponse> {
  const response = await api.put<ProfileResponse>('/auth/profile', {
    firstName: input.firstName.trim(),
    lastName: input.lastName?.trim() ?? '',
  });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'No pudimos actualizar tu información personal');
  }
  return response.data;
}
