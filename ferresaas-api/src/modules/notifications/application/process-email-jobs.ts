import crypto from 'node:crypto';
import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { EmailSender } from '../infrastructure/email/email-sender';
import { logger } from '../../../config/logger';

const MAX_ATTEMPTS = 5;

const email = new EmailSender();

interface ClaimedJob {
  id: string;
  businessId: string;
  recipient: string;
  firstName: string;
  attempts: number;
}

/**
 * email_jobs está bajo RLS + FORCE (PR 3.1): el runtime no tiene DML libre sobre
 * ella. El worker opera sólo a través de capacidades globales explícitas:
 * private.claim_email_job (reclamo con lock) y private.finish_email_job
 * (finalización condicionada por lockToken).
 */
async function claimJob(): Promise<{ job: ClaimedJob; lockToken: string } | null> {
  const lockToken = crypto.randomUUID();
  const rows = await unitOfWork.runPublic(async tx =>
    tx.$queryRaw<ClaimedJob[]>`SELECT * FROM private.claim_email_job(${lockToken}, ${MAX_ATTEMPTS}::integer)`,
  );
  const job = rows.at(0);
  return job ? { job, lockToken } : null;
}

/**
 * Finaliza el job SÓLO si este proceso todavía posee el lock (R1/R4):
 * la condición lockToken dentro de la función evita que un worker tardío
 * sobrescriba el estado de otro que reclamó el job cuando expiró el lock.
 */
async function finalize(
  jobId: string,
  lockToken: string,
  data: { status: string; availableAt: Date | null; lastError: string | null },
): Promise<boolean> {
  const rows = await unitOfWork.runPublic(async tx =>
    tx.$queryRaw<Array<{ finish_email_job: boolean }>>`
      SELECT private.finish_email_job(${jobId}, ${lockToken}, ${data.status}, ${data.availableAt}::timestamptz, ${data.lastError}) AS finish_email_job`,
  );
  return rows.at(0)?.finish_email_job === true;
}

export async function processEmailJobs(): Promise<number> {
  const claimed = await claimJob();
  if (!claimed) return 0;
  const { job, lockToken } = claimed;

  try {
    await email.sendWelcomeEmail(job.recipient, job.firstName);
    const finalizado = await finalize(job.id, lockToken, { status: 'SENT', availableAt: null, lastError: null });
    if (!finalizado) {
      logger.warn({ id: job.id }, 'Email job sent but lock was lost; leaving state to the current owner');
    }
  } catch (error) {
    // attempts ya fue incrementado al reclamar: MAX_ATTEMPTS envíos reales antes de FAILED.
    const retrying = job.attempts < MAX_ATTEMPTS;
    const delaySeconds = Math.min(60 * job.attempts, 900);
    logger.warn({ id: job.id, attempts: job.attempts, error }, 'Email job failed');
    await finalize(job.id, lockToken, {
      status: retrying ? 'RETRYING' : 'FAILED',
      availableAt: new Date(Date.now() + delaySeconds * 1000),
      lastError: error instanceof Error ? error.message : String(error),
    });
  }
  return 1;
}
