import type { Transaction } from '../../../platform/tenancy/unit-of-work';

export class EmailJobStore {
  constructor(private readonly tx: Transaction) {}

  enqueue(input: { id: string; businessId: string; recipient: string; firstName: string }) {
    return this.tx.emailJob.create({ data: input });
  }
}
