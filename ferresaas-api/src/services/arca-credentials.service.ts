import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { decryptSecret, encryptSecret } from '../utils/secure-config';
import { ArcaWsaaService } from './arca-wsaa.service';

export interface ArcaProviderCredentials {
  cuit: string;
  token: string;
  sign: string;
  wsfeUrl: string;
  wsaaUrl?: string;
  environment: 'homo' | 'prod';
}

const DEFAULT_WSFE_HOMO = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
const DEFAULT_WSAA_HOMO = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';

export class ArcaCredentialsService {
  private static refreshInFlight = new Map<string, Promise<ArcaProviderCredentials | null>>();

  static async getProviderCredentials(
    businessId: string
  ): Promise<ArcaProviderCredentials | null> {
    const tenantCredential = await prisma.businessArcaCredential.findUnique({
      where: { businessId },
      select: {
        isEnabled: true,
        cuit: true,
        tokenEncrypted: true,
        signEncrypted: true,
        tokenExpiresAt: true,
        serviceName: true,
        certificatePemEncrypted: true,
        privateKeyPemEncrypted: true,
        wsfeUrl: true,
        wsaaUrl: true,
        environment: true,
      },
    });

    if (tenantCredential?.isEnabled) {
      try {
        const hasTokenAndSign = Boolean(tenantCredential.tokenEncrypted && tenantCredential.signEncrypted);
        const hasCertificateMaterial = Boolean(
          tenantCredential.certificatePemEncrypted && tenantCredential.privateKeyPemEncrypted
        );

        if (!hasTokenAndSign && hasCertificateMaterial) {
          const refreshedCredentials = await this.refreshTenantCredentialsIfNeeded(businessId, {
            force: true,
          });

          if (refreshedCredentials) {
            return refreshedCredentials;
          }
        }

        const shouldRefreshToken = this.shouldRefreshToken(tenantCredential.tokenExpiresAt);
        if (shouldRefreshToken) {
          const refreshedCredentials = await this.refreshTenantCredentialsIfNeeded(businessId, {
            force: true,
          });

          if (refreshedCredentials) {
            return refreshedCredentials;
          }
        }

        if (tenantCredential.tokenEncrypted && tenantCredential.signEncrypted) {
          return {
            cuit: tenantCredential.cuit,
            token: decryptSecret(tenantCredential.tokenEncrypted),
            sign: decryptSecret(tenantCredential.signEncrypted),
            wsfeUrl: tenantCredential.wsfeUrl || DEFAULT_WSFE_HOMO,
            wsaaUrl: tenantCredential.wsaaUrl || DEFAULT_WSAA_HOMO,
            environment: tenantCredential.environment === 'prod' ? 'prod' : 'homo',
          };
        }
      } catch (error) {
        logger.error(
          {
            businessId,
            error: error instanceof Error ? error.message : 'Unknown decrypt error',
          },
          'Failed to decrypt tenant ARCA credentials'
        );
      }
    }

    if (env.invoice.arca.cuit && env.invoice.arca.token && env.invoice.arca.sign) {
      logger.warn(
        { businessId },
        'Using global ARCA credentials fallback from environment variables'
      );

      return {
        cuit: env.invoice.arca.cuit,
        token: env.invoice.arca.token,
        sign: env.invoice.arca.sign,
        wsfeUrl: env.invoice.arca.wsfeUrl || DEFAULT_WSFE_HOMO,
        wsaaUrl: env.invoice.arca.wsaaUrl || DEFAULT_WSAA_HOMO,
        environment: 'homo',
      };
    }

    return null;
  }

  static async refreshTenantCredentialsIfNeeded(
    businessId: string,
    options: { force?: boolean } = {}
  ): Promise<ArcaProviderCredentials | null> {
    const currentRefresh = this.refreshInFlight.get(businessId);
    if (currentRefresh) {
      return currentRefresh;
    }

    const refreshPromise = this.refreshTenantCredentialsInternal(businessId, options)
      .catch((error) => {
        logger.error(
          {
            businessId,
            error: error instanceof Error ? error.message : 'Unknown refresh error',
          },
          'Failed to refresh ARCA credentials'
        );
        return null;
      })
      .finally(() => {
        this.refreshInFlight.delete(businessId);
      });

    this.refreshInFlight.set(businessId, refreshPromise);
    return refreshPromise;
  }

  private static shouldRefreshToken(tokenExpiresAt?: Date | null): boolean {
    if (!tokenExpiresAt) {
      return false;
    }

    const marginMinutes = Math.max(1, env.invoice.arca.refreshMinutesBeforeExpiry || 20);
    const marginMs = marginMinutes * 60 * 1000;
    return tokenExpiresAt.getTime() - Date.now() <= marginMs;
  }

  private static async refreshTenantCredentialsInternal(
    businessId: string,
    options: { force?: boolean }
  ): Promise<ArcaProviderCredentials | null> {
    const tenantCredential = await prisma.businessArcaCredential.findUnique({
      where: { businessId },
      select: {
        businessId: true,
        cuit: true,
        environment: true,
        serviceName: true,
        wsfeUrl: true,
        wsaaUrl: true,
        tokenEncrypted: true,
        signEncrypted: true,
        tokenExpiresAt: true,
        isEnabled: true,
        certificatePemEncrypted: true,
        privateKeyPemEncrypted: true,
      },
    });

    if (!tenantCredential?.isEnabled) {
      return null;
    }

    if (
      !options.force &&
      tenantCredential.tokenEncrypted &&
      tenantCredential.signEncrypted &&
      !this.shouldRefreshToken(tenantCredential.tokenExpiresAt)
    ) {
      return {
        cuit: tenantCredential.cuit,
        token: decryptSecret(tenantCredential.tokenEncrypted),
        sign: decryptSecret(tenantCredential.signEncrypted),
        wsfeUrl: tenantCredential.wsfeUrl || DEFAULT_WSFE_HOMO,
        wsaaUrl: tenantCredential.wsaaUrl || DEFAULT_WSAA_HOMO,
        environment: tenantCredential.environment === 'prod' ? 'prod' : 'homo',
      };
    }

    if (!tenantCredential.certificatePemEncrypted || !tenantCredential.privateKeyPemEncrypted) {
      logger.warn(
        { businessId },
        'Skipping ARCA WSAA refresh: missing certificate/private key in tenant credentials'
      );
      return null;
    }

    const certificatePem = decryptSecret(tenantCredential.certificatePemEncrypted);
    const privateKeyPem = decryptSecret(tenantCredential.privateKeyPemEncrypted);

    const wsaaResult = await ArcaWsaaService.loginCms({
      certificatePem,
      privateKeyPem,
      serviceName: tenantCredential.serviceName || 'wsfe',
      wsaaUrl: tenantCredential.wsaaUrl || DEFAULT_WSAA_HOMO,
    });

    const updatedCredential = await prisma.businessArcaCredential.update({
      where: { businessId },
      data: {
        tokenEncrypted: encryptSecret(wsaaResult.token),
        signEncrypted: encryptSecret(wsaaResult.sign),
        tokenExpiresAt: wsaaResult.expiresAt,
      },
      select: {
        cuit: true,
        environment: true,
        wsfeUrl: true,
        wsaaUrl: true,
        tokenEncrypted: true,
        signEncrypted: true,
      },
    });

    logger.info(
      {
        businessId,
        tokenExpiresAt: wsaaResult.expiresAt,
      },
      'ARCA WSAA token/sign refreshed for tenant'
    );

    return {
      cuit: updatedCredential.cuit,
      token: decryptSecret(updatedCredential.tokenEncrypted!),
      sign: decryptSecret(updatedCredential.signEncrypted!),
      wsfeUrl: updatedCredential.wsfeUrl || DEFAULT_WSFE_HOMO,
      wsaaUrl: updatedCredential.wsaaUrl || DEFAULT_WSAA_HOMO,
      environment: updatedCredential.environment === 'prod' ? 'prod' : 'homo',
    };
  }

  static async upsertTenantCredentials(input: {
    businessId: string;
    cuit: string;
    token?: string;
    sign?: string;
    wsfeUrl?: string;
    wsaaUrl?: string;
    environment?: 'homo' | 'prod';
    tokenExpiresAt?: Date;
    certificatePem?: string;
    privateKeyPem?: string;
    isEnabled?: boolean;
  }) {
    const existingCredential = await prisma.businessArcaCredential.findUnique({
      where: { businessId: input.businessId },
      select: {
        tokenEncrypted: true,
        signEncrypted: true,
      },
    });

    const nextTokenEncrypted = input.token
      ? encryptSecret(input.token)
      : existingCredential?.tokenEncrypted || null;

    const nextSignEncrypted = input.sign
      ? encryptSecret(input.sign)
      : existingCredential?.signEncrypted || null;

    return prisma.businessArcaCredential.upsert({
      where: { businessId: input.businessId },
      create: {
        businessId: input.businessId,
        cuit: input.cuit,
        tokenEncrypted: nextTokenEncrypted,
        signEncrypted: nextSignEncrypted,
        wsfeUrl: input.wsfeUrl,
        wsaaUrl: input.wsaaUrl,
        environment: input.environment || 'homo',
        tokenExpiresAt: input.tokenExpiresAt,
        certificatePemEncrypted: input.certificatePem
          ? encryptSecret(input.certificatePem)
          : null,
        privateKeyPemEncrypted: input.privateKeyPem ? encryptSecret(input.privateKeyPem) : null,
        isEnabled: input.isEnabled ?? true,
      },
      update: {
        cuit: input.cuit,
        tokenEncrypted: nextTokenEncrypted,
        signEncrypted: nextSignEncrypted,
        wsfeUrl: input.wsfeUrl,
        wsaaUrl: input.wsaaUrl,
        environment: input.environment || 'homo',
        tokenExpiresAt: input.tokenExpiresAt,
        certificatePemEncrypted: input.certificatePem
          ? encryptSecret(input.certificatePem)
          : undefined,
        privateKeyPemEncrypted: input.privateKeyPem ? encryptSecret(input.privateKeyPem) : undefined,
        isEnabled: input.isEnabled ?? true,
      },
    });
  }
}
