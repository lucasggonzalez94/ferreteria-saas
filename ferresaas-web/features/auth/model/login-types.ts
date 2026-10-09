import type { User, BusinessInfo } from '@/types';

export interface LoginResponse {
  user: User;
  business: BusinessInfo;
  accessToken: string;
  csrfToken: string;
  csrfHash: string;
}
