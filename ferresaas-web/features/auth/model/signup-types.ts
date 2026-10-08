export type TaxCondition = "RESPONSABLE_INSCRIPTO" | "MONOTRIBUTO" | "EXENTO";

import type { LoginResponse } from '@/types';

export type SignupResponse = LoginResponse;

export interface SignupRequest {
  businessName: string;
  businessCuit: string;
  taxCondition: TaxCondition;
  phone?: string;
  address?: string;
  timezone?: string;
  ownerFirstName: string;
  ownerLastName?: string;
  email: string;
  password: string;
}
