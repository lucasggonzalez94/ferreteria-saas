import { z } from 'zod';

export const issueCheckSchema = z.object({
  accountId: z.string().cuid(),
  checkNumber: z.string().trim().min(1).max(100),
  amount: z.number().positive(),
  currency: z.enum(['ARS', 'USD']).optional(),
  dueDate: z.string().datetime(),
  recipientName: z.string().trim().min(1).max(200),
  notes: z.string().max(1000).optional(),
});

export type IssueCheckInput = z.infer<typeof issueCheckSchema>;
