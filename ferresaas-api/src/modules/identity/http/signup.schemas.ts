import { z } from 'zod';

export const signupSchema = z.object({
  businessName: z.string().trim().min(1).max(150),
  businessCuit: z.string().trim().min(11).max(20),
  taxCondition: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO']),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(200).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  ownerFirstName: z.string().trim().min(1).max(100),
  ownerLastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(10),
});

export type SignupInput = z.infer<typeof signupSchema>;
