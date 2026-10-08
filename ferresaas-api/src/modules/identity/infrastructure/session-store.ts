import type { Transaction } from '../../../platform/tenancy/unit-of-work';
import { IDLE_MS } from '../domain/session-policy';

export interface SessionRecord {
  id: string;
  businessId: string;
  userId: string;
  securityVersion: number;
}

export interface CreateSessionInput {
  id: string;
  businessId: string;
  userId: string;
  tokenHash: string;
  securityVersion: number;
  ip?: string;
  userAgent?: string;
}

const ABSOLUTE_DAYS_FACTOR = 30 * 24 * 60 * 60 * 1000;

export class SessionStore {
  constructor(private readonly tx: Transaction) {}

  create(input: CreateSessionInput) {
    const now = Date.now();
    return this.tx.authSession.create({
      data: {
        id: input.id,
        businessId: input.businessId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        securityVersion: input.securityVersion,
        expiresAt: new Date(now + IDLE_MS),
        absoluteExpiresAt: new Date(now + ABSOLUTE_DAYS_FACTOR),
        ipAddress: input.ip,
        userAgent: input.userAgent,
      },
    });
  }

  findActiveByHash(tokenHash: string) {
    const now = new Date();
    return this.tx.authSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
    });
  }

  /** Rotación condicionada: un solo ganador por hash. */
  async rotate(currentHash: string, nextHash: string, expiresAt: Date, ip?: string, userAgent?: string) {
    const updated = await this.tx.authSession.updateMany({
      where: { tokenHash: currentHash, revokedAt: null },
      data: { tokenHash: nextHash, expiresAt, lastUsedAt: new Date(), ipAddress: ip, userAgent },
    });
    return updated.count === 1;
  }

  async consumeToken(session: SessionRecord, tokenHash: string) {
    await this.tx.consumedRefreshToken.create({
      data: {
        businessId: session.businessId,
        sessionId: session.id,
        tokenHash,
        expiresAt: new Date(Date.now() + IDLE_MS),
      },
    });
  }

  findConsumed(tokenHash: string) {
    return this.tx.consumedRefreshToken.findUnique({ where: { tokenHash } });
  }

  async revoke(session: SessionRecord) {
    await this.tx.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    await this.tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
