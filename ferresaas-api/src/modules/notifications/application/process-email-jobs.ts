import crypto from 'node:crypto';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { EmailSender } from '../infrastructure/email/email-sender';
import { logger } from '../../../config/logger';

const MAX_ATTEMPTS = 5;

const email = new EmailSender();

async function claimJob() {
  const lockToken = crypto.randomUUID();
  const rows = await unitOfWork.runPublic(async tx => {
    const found = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE email_jobs
         SET status='PROCESSING', "lockedAt"=CURRENT_TIMESTAMP, "lockToken"=${lockToken},
             attempts=attempts+1
       WHERE id = (
         SELECT id FROM email_jobs
          WHERE (status IN ('PENDING','RETRYING') AND "availableAt" <= CURRENT_TIMESTAMP
                 OR status='PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
            AND attempts < ${MAX_ATTEMPTS}
          ORDER BY "availableAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
      RETURNING id`;
    return found;
  });
  if (rows.length === 0) return null;
  return unitOfWork.runPublic(async tx =>
    tx.emailJob.findUnique({ where: { id: rows[0].id } }),
  );
}

export async function processEmailJobs(): Promise<number> {
  const job = await claimJob();
  if (!job) return 0;
  try {
    await email.sendWelcomeEmail(job.recipient, job.firstName);
    await unitOfWork.runPublic(tx =>
      tx.emailJob.update({ where: { id: job.id }, data: { status: 'SENT' } }),
    );
  } catch (error) {
    const retrying = job.attempts + 1 < MAX_ATTEMPTS;
    const delaySeconds = Math.min(60 * job.attempts, 900);
    logger.warn({ id: job.id, attempts: job.attempts, error }, 'Email job failed');
    await unitOfWork.runPublic(tx =>
      tx.emailJob.update({
        where: { id: job.id },
        data: {
          status: retrying ? 'RETRYING' : 'FAILED',
          availableAt: new Date(Date.now() + delaySeconds * 1000),
          lastError: error instanceof Error ? error.message : String(error),
          lockedAt: null,
          lockToken: null,
        },
      }),
    );
  }
  return 1;
}
