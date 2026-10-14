import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma, adminPrisma } from './setup';
import { closeDatabase } from '@/platform/database/client';
import { TenantUnitOfWork } from '@/platform/tenancy/unit-of-work';

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockSendWelcomeEmail = jest.fn() as any;

jest.mock('@/modules/notifications/infrastructure/email/email-sender', () => ({
  EmailSender: jest.fn().mockImplementation(() => ({
    sendWelcomeEmail: mockSendWelcomeEmail,
  })),
}));

import { processEmailJobs } from '@/modules/notifications/application/process-email-jobs';

const stamp = crypto.randomUUID();
const tenantId = crypto.randomUUID();
const uow = new TenantUnitOfWork(prisma);

// email_jobs está bajo RLS (PR 3.1): los fixtures del rol runtime van con
// contexto tenant; la manipulación adversarial (robo de lock) usa el rol admin.
const readJob = (id: string) => uow.run({ businessId: tenantId }, tx => tx.emailJob.findUniqueOrThrow({ where: { id } }));

async function waitUntil(fn: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('waitUntil timeout');
    await new Promise(r => setTimeout(r, 10));
  }
}

function createJob(data: { status?: string; attempts?: number; lockedAt?: Date | null; lockToken?: string | null; availableAt?: Date }) {
  return uow.run({ businessId: tenantId }, tx => tx.emailJob.create({
    data: {
      id: crypto.randomUUID(),
      businessId: tenantId,
      recipient: `worker-${stamp}@test.example`,
      firstName: 'Tester',
      status: data.status ?? 'PENDING',
      attempts: data.attempts ?? 0,
      lockedAt: data.lockedAt ?? null,
      lockToken: data.lockToken ?? null,
      // email_jobs es global y el claim es FIFO por availableAt: 1min en el pasado
      // garantiza que el worker tome NUESTRO job antes que cualquier fila ajena
      // recién encolada (sus availableAt son 'now') incluso con suites en paralelo.
      availableAt: data.availableAt ?? new Date(Date.now() - 60_000),
    },
  }));
}

describe('Email job worker (PostgreSQL real)', () => {
  beforeAll(async () => {
    await adminPrisma.business.create({
      data: {
        id: tenantId,
        name: 'Tenant worker',
        cuit: tenantId.replace(/\D/g, '').padEnd(11, '1').slice(0, 11),
        taxCondition: 'MONOTRIBUTO',
      },
    });
  });

  beforeEach(async () => {
    mockSendWelcomeEmail.mockReset();
    mockSendWelcomeEmail.mockResolvedValue(undefined);
    // Se limpian sólo los jobs de ESTA suite (prefix worker-); los de otras
    // suites (p.ej. admin-register) no se tocan.
    await uow.run({ businessId: tenantId }, tx =>
      tx.emailJob.deleteMany({ where: { recipient: { startsWith: 'worker-' } } }));
  });

  afterAll(async () => {
    await closeDatabase();
    await prisma.$disconnect();
    await adminPrisma.business.deleteMany({ where: { id: tenantId } });
    await adminPrisma.$disconnect();
  });

  it('envía un job pendiente y lo marca SENT', async () => {
    const job = await createJob({});
    expect(await processEmailJobs()).toBe(1);
    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
    const updated = await readJob(job.id);
    expect(updated.status).toBe('SENT');
    expect(updated.attempts).toBe(1);
  });

  it('un fallo deja el job RETRYING con backoff y lastError, sin perder el lock para otro dueño', async () => {
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error('smtp caído'));
    const job = await createJob({});
    expect(await processEmailJobs()).toBe(1);
    const updated = await readJob(job.id);
    expect(updated.status).toBe('RETRYING');
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toContain('smtp caído');
    expect(updated.availableAt.getTime()).toBeGreaterThan(Date.now() + 30_000);
    // No es reclamable hasta que venza el backoff: iteraciones extra no lo tocan
    // (pueden procesar filas ajenas de otras suites; nuestro job no se reenvía).
    await processEmailJobs();
    await processEmailJobs();
    const callsToOurs = (mockSendWelcomeEmail.mock.calls as any[][])
      .filter(args => args[0] === job.recipient).length;
    expect(callsToOurs).toBe(1);
    expect((await readJob(job.id)).status).toBe('RETRYING');
  });

  it('el límite de intentos permite los 5 envíos reales y falla definitivo en el quinto', async () => {
    mockSendWelcomeEmail.mockRejectedValue(new Error('smtp caído'));
    // 4to envío falla: queda RETRYING (todavía puede correr el 5to).
    // availableAt eventos ordenan el claim: cuarto primero, quinto después.
    const cuarto = await createJob({ attempts: 3, availableAt: new Date(Date.now() - 120_000) });
    await processEmailJobs();
    expect(await readJob(cuarto.id)).toMatchObject({
      status: 'RETRYING',
      attempts: 4,
    });
    // 5to envío falla: FAILED definitivo.
    const quinto = await createJob({ attempts: 4, availableAt: new Date(Date.now() - 60_000) });
    await processEmailJobs();
    expect(await readJob(quinto.id)).toMatchObject({
      status: 'FAILED',
      attempts: 5,
    });
  });

  it('un job PROCESSING con lock vencido es reclamado por otro worker', async () => {
    const job = await createJob({
      status: 'PROCESSING',
      attempts: 1,
      lockedAt: new Date(Date.now() - 10 * 60_000),
      lockToken: 'lock-muerto',
    });
    expect(await processEmailJobs()).toBe(1);
    const updated = await readJob(job.id);
    expect(updated.status).toBe('SENT');
    expect(updated.attempts).toBe(2);
  });

  it('un worker tardío no sobrescribe el estado de quien le robó el lock', async () => {
    const job = await createJob({});
    const slow = deferred();
    mockSendWelcomeEmail.mockImplementation(() => slow.promise);

    const running = processEmailJobs();
    await waitUntil(() => mockSendWelcomeEmail.mock.calls.length === 1);

    // Otro proceso reclamó el job (lock de 5 min vencido) y lo está tratando como suyo.
    // La manipulación adversarial se hace con el rol admin de fixtures, equivalente a
    // un claim concurrente a nivel de fila.
    await adminPrisma.emailJob.update({
      where: { id: job.id },
      data: { lockToken: 'otro-worker', lockedAt: new Date() },
    });

    slow.resolve();
    await running;

    const updated = await readJob(job.id);
    // El email se envió, pero el estado pertenece al dueño actual del lock.
    expect(updated.status).toBe('PROCESSING');
    expect(updated.lockToken).toBe('otro-worker');
  });
});
