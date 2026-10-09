import type { Transaction } from '../../../platform/tenancy/unit-of-work';

/** Resoluciones puntuales antes de fijar tenant. Nunca expone una tabla completa. */
export class BootstrapStore {
  constructor(private readonly tx: Transaction) {}

  async credentials(email: string) {
    const rows = await this.tx.$queryRaw<Array<{
      id: string; business_id: string; password_hash: string; active: boolean;
    }>>`SELECT * FROM private.login_identity(${email})`;
    return rows.at(0) ?? null;
  }

  async conflicts(email: string, cuit: string) {
    const rows = await this.tx.$queryRaw<Array<{ email_exists: boolean; cuit_exists: boolean }>>`
      SELECT * FROM private.identity_conflicts(${email}, ${cuit})`;
    return rows[0];
  }

  async sessionByHash(hash: string) {
    const rows = await this.tx.$queryRaw<Array<{ id: string; business_id: string }>>`
      SELECT * FROM private.session_tenant_by_hash(${hash})`;
    return rows.at(0) ?? null;
  }

  async sessionById(id: string) {
    const rows = await this.tx.$queryRaw<Array<{ business_id: string }>>`
      SELECT * FROM private.session_tenant_by_id(${id})`;
    return rows.at(0) ?? null;
  }

  async consumedByHash(hash: string) {
    const rows = await this.tx.$queryRaw<Array<{ session_id: string; business_id: string }>>`
      SELECT * FROM private.consumed_token_tenant(${hash})`;
    return rows.at(0) ?? null;
  }

  async resetByHash(hash: string) {
    const rows = await this.tx.$queryRaw<Array<{ id: string; business_id: string }>>`
      SELECT * FROM private.reset_identity(${hash})`;
    return rows.at(0) ?? null;
  }
}
