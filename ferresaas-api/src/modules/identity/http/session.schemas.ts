import { z } from 'zod';
// El objeto es vacío a propósito: la identidad viene exclusivamente de la cookie.
export const emptyBodySchema = z.object({}).passthrough();
