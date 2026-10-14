import { unitOfWork } from '../../../platform/tenancy/unit-of-work';
import { logger } from '../../../config/logger';

/**
 * Retención de consumed_refresh_tokens (PR 3.4): borra hashes cuya vigencia
 * absoluta ya venció. La tabla es tenant-owned con FORCE RLS, así que la
 * limpieza usa la capacidad global explícita private.purge_consumed_refresh_tokens
 * ejecutada por el definer dedicado — no DML libre del runtime.
 */
export async function cleanupConsumedRefreshTokens(): Promise<number> {
  const rows = await unitOfWork.runPublic(async tx =>
    tx.$queryRaw<Array<{ purge_consumed_refresh_tokens: number }>>`
      SELECT private.purge_consumed_refresh_tokens(${new Date()}::timestamptz) AS purge_consumed_refresh_tokens`,
  );
  const purged = rows.at(0)?.purge_consumed_refresh_tokens ?? 0;
  if (purged > 0) logger.info({ purged }, 'Consumed refresh tokens purged');
  return purged;
}
