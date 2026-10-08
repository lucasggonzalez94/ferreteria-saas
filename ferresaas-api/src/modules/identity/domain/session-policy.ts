export const sessionPolicy = {
  /** Access token JWT */
  accessTokenSeconds: 15 * 60,
  /** Refresh por inactividad */
  idleDays: 7,
  /** Límite absoluto de la sesión desde su creación */
  absoluteDays: 30,
  /** Ventana de gracia por doble refresh concurrente reciente */
  concurrentRaceMs: 5_000,
} as const;

export const IDLE_MS = sessionPolicy.idleDays * 24 * 60 * 60 * 1000;
export const ABSOLUTE_MS = sessionPolicy.absoluteDays * 24 * 60 * 60 * 1000;
