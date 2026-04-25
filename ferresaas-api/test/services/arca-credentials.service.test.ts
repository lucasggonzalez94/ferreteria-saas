import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrisma = {
  businessArcaCredential: {
    findUnique: jest.fn() as any,
    update: jest.fn() as any,
    upsert: jest.fn() as any,
  },
};

const mockLogger = {
  info: jest.fn() as any,
  warn: jest.fn() as any,
  error: jest.fn() as any,
};

const mockEnv = {
  invoice: {
    arca: {
      cuit: undefined as string | undefined,
      token: undefined as string | undefined,
      sign: undefined as string | undefined,
      wsfeUrl: undefined as string | undefined,
      wsaaUrl: undefined as string | undefined,
      refreshMinutesBeforeExpiry: 20,
    },
    credentialsSecret: 'x'.repeat(32),
  },
};

const mockSecureConfig = {
  decryptSecret: jest.fn((value: string) => `dec(${value})`) as any,
  encryptSecret: jest.fn((value: string) => `enc(${value})`) as any,
};

const mockArcaWsaaService = {
  loginCms: jest.fn() as any,
};

jest.mock('@/config/database', () => ({ prisma: mockPrisma }));
jest.mock('@/config/logger', () => ({ logger: mockLogger }));
jest.mock('@/config/env', () => ({ env: mockEnv }));
jest.mock('@/utils/secure-config', () => mockSecureConfig);
jest.mock('@/services/arca-wsaa.service', () => ({ ArcaWsaaService: mockArcaWsaaService }));

import { ArcaCredentialsService } from '@/services/arca-credentials.service';

describe('ArcaCredentialsService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (ArcaCredentialsService as any).refreshInFlight.clear();
    mockSecureConfig.decryptSecret.mockImplementation((value: string) => `dec(${value})`);
    mockSecureConfig.encryptSecret.mockImplementation((value: string) => `enc(${value})`);
    mockEnv.invoice.arca.cuit = undefined;
    mockEnv.invoice.arca.token = undefined;
    mockEnv.invoice.arca.sign = undefined;
    mockEnv.invoice.arca.wsfeUrl = undefined;
    mockEnv.invoice.arca.wsaaUrl = undefined;
    mockEnv.invoice.arca.refreshMinutesBeforeExpiry = 20;
  });

  describe('getProviderCredentials', () => {
    it('returns active tenant credentials decrypting token/sign', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        isEnabled: true,
        cuit: '20301234567',
        tokenEncrypted: 'token-encrypted',
        signEncrypted: 'sign-encrypted',
        tokenExpiresAt: null,
        serviceName: 'wsfe',
        certificatePemEncrypted: null,
        privateKeyPemEncrypted: null,
        wsfeUrl: null,
        wsaaUrl: null,
        environment: 'homo',
      });

      const result = await ArcaCredentialsService.getProviderCredentials('biz-1');

      expect(result).toEqual({
        cuit: '20301234567',
        token: 'dec(token-encrypted)',
        sign: 'dec(sign-encrypted)',
        wsfeUrl: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
        wsaaUrl: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
        environment: 'homo',
      });
    });

    it('uses environment fallback credentials when tenant credentials are unavailable', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue(null);
      mockEnv.invoice.arca.cuit = '20999999991';
      mockEnv.invoice.arca.token = 'env-token';
      mockEnv.invoice.arca.sign = 'env-sign';
      mockEnv.invoice.arca.wsfeUrl = 'https://custom-wsfe';
      mockEnv.invoice.arca.wsaaUrl = 'https://custom-wsaa';

      const result = await ArcaCredentialsService.getProviderCredentials('biz-2');

      expect(result).toEqual({
        cuit: '20999999991',
        token: 'env-token',
        sign: 'env-sign',
        wsfeUrl: 'https://custom-wsfe',
        wsaaUrl: 'https://custom-wsaa',
        environment: 'homo',
      });
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('forces refresh when token/sign are missing but certificate material is present', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        isEnabled: true,
        cuit: '20301234567',
        tokenEncrypted: null,
        signEncrypted: null,
        tokenExpiresAt: null,
        serviceName: 'wsfe',
        certificatePemEncrypted: 'cert-encrypted',
        privateKeyPemEncrypted: 'key-encrypted',
        wsfeUrl: null,
        wsaaUrl: null,
        environment: 'prod',
      });

      const refreshSpy = jest
        .spyOn(ArcaCredentialsService, 'refreshTenantCredentialsIfNeeded')
        .mockResolvedValue({
          cuit: '20301234567',
          token: 'new-token',
          sign: 'new-sign',
          wsfeUrl: 'https://prod-wsfe',
          wsaaUrl: 'https://prod-wsaa',
          environment: 'prod',
        });

      const result = await ArcaCredentialsService.getProviderCredentials('biz-3');

      expect(refreshSpy).toHaveBeenCalledWith('biz-3', { force: true });
      expect(result?.token).toBe('new-token');
    });

    it('logs decrypt errors and returns null when no fallback exists', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        isEnabled: true,
        cuit: '20301234567',
        tokenEncrypted: 'token-encrypted',
        signEncrypted: 'sign-encrypted',
        tokenExpiresAt: null,
        serviceName: 'wsfe',
        certificatePemEncrypted: null,
        privateKeyPemEncrypted: null,
        wsfeUrl: null,
        wsaaUrl: null,
        environment: 'homo',
      });
      mockSecureConfig.decryptSecret.mockImplementation(() => {
        throw new Error('decrypt failed');
      });

      const result = await ArcaCredentialsService.getProviderCredentials('biz-4');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('refreshTenantCredentialsIfNeeded', () => {
    it('deduplicates concurrent refreshes for the same businessId', async () => {
      const internalSpy = jest
        .spyOn(ArcaCredentialsService as any, 'refreshTenantCredentialsInternal')
        .mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () =>
                  resolve({
                    cuit: '20301234567',
                    token: 't',
                    sign: 's',
                    wsfeUrl: 'x',
                    wsaaUrl: 'y',
                    environment: 'homo',
                  }),
                10
              );
            })
        );

      const [resultA, resultB] = await Promise.all([
        ArcaCredentialsService.refreshTenantCredentialsIfNeeded('biz-same', { force: true }),
        ArcaCredentialsService.refreshTenantCredentialsIfNeeded('biz-same', { force: true }),
      ]);

      expect(internalSpy).toHaveBeenCalledTimes(1);
      expect(resultA).toEqual(resultB);
    });

    it('returns null and logs when internal refresh throws', async () => {
      const internalSpy = jest
        .spyOn(ArcaCredentialsService as any, 'refreshTenantCredentialsInternal')
        .mockRejectedValue(new Error('refresh failed'));

      const first = await ArcaCredentialsService.refreshTenantCredentialsIfNeeded('biz-err', {
        force: true,
      });
      const second = await ArcaCredentialsService.refreshTenantCredentialsIfNeeded('biz-err', {
        force: true,
      });

      expect(first).toBeNull();
      expect(second).toBeNull();
      expect(internalSpy).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('refreshTenantCredentialsInternal (via public API)', () => {
    it('returns current token/sign when not forced and token is still valid', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        businessId: 'biz-keep',
        cuit: '20301234567',
        environment: 'homo',
        serviceName: 'wsfe',
        wsfeUrl: null,
        wsaaUrl: null,
        tokenEncrypted: 'enc-token',
        signEncrypted: 'enc-sign',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isEnabled: true,
        certificatePemEncrypted: 'enc-cert',
        privateKeyPemEncrypted: 'enc-key',
      });

      const result = await (ArcaCredentialsService as any).refreshTenantCredentialsInternal(
        'biz-keep',
        {}
      );

      expect(result?.token).toBe('dec(enc-token)');
      expect(result?.sign).toBe('dec(enc-sign)');
      expect(mockArcaWsaaService.loginCms).not.toHaveBeenCalled();
    });

    it('returns null when certificate/private key are missing', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        businessId: 'biz-nocert',
        cuit: '20301234567',
        environment: 'homo',
        serviceName: 'wsfe',
        wsfeUrl: null,
        wsaaUrl: null,
        tokenEncrypted: null,
        signEncrypted: null,
        tokenExpiresAt: null,
        isEnabled: true,
        certificatePemEncrypted: null,
        privateKeyPemEncrypted: null,
      });

      const result = await (ArcaCredentialsService as any).refreshTenantCredentialsInternal(
        'biz-nocert',
        { force: true }
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('refreshes token/sign through WSAA and persists encrypted values', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        businessId: 'biz-refresh',
        cuit: '20301234567',
        environment: 'prod',
        serviceName: 'wsfe',
        wsfeUrl: 'https://custom-wsfe',
        wsaaUrl: 'https://custom-wsaa',
        tokenEncrypted: null,
        signEncrypted: null,
        tokenExpiresAt: null,
        isEnabled: true,
        certificatePemEncrypted: 'enc-cert',
        privateKeyPemEncrypted: 'enc-key',
      });

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      mockArcaWsaaService.loginCms.mockResolvedValue({
        token: 'wsaa-token',
        sign: 'wsaa-sign',
        expiresAt,
      });
      mockPrisma.businessArcaCredential.update.mockResolvedValue({
        cuit: '20301234567',
        environment: 'prod',
        wsfeUrl: 'https://custom-wsfe',
        wsaaUrl: 'https://custom-wsaa',
        tokenEncrypted: 'enc(wsaa-token)',
        signEncrypted: 'enc(wsaa-sign)',
      });

      const result = await (ArcaCredentialsService as any).refreshTenantCredentialsInternal(
        'biz-refresh',
        { force: true }
      );

      expect(mockArcaWsaaService.loginCms).toHaveBeenCalledWith(
        expect.objectContaining({
          certificatePem: 'dec(enc-cert)',
          privateKeyPem: 'dec(enc-key)',
        })
      );
      expect(mockPrisma.businessArcaCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenEncrypted: 'enc(wsaa-token)',
            signEncrypted: 'enc(wsaa-sign)',
            tokenExpiresAt: expiresAt,
          }),
        })
      );
      expect(result).toEqual({
        cuit: '20301234567',
        token: 'dec(enc(wsaa-token))',
        sign: 'dec(enc(wsaa-sign))',
        wsfeUrl: 'https://custom-wsfe',
        wsaaUrl: 'https://custom-wsaa',
        environment: 'prod',
      });
    });
  });

  describe('upsertTenantCredentials', () => {
    it('creates credentials encrypting token, sign, cert and key', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue(null);
      mockPrisma.businessArcaCredential.upsert.mockResolvedValue({ id: 'cred-1' });

      await ArcaCredentialsService.upsertTenantCredentials({
        businessId: 'biz-create',
        cuit: '20301234567',
        token: 'plain-token',
        sign: 'plain-sign',
        certificatePem: 'plain-cert',
        privateKeyPem: 'plain-key',
      });

      expect(mockSecureConfig.encryptSecret).toHaveBeenCalledWith('plain-token');
      expect(mockSecureConfig.encryptSecret).toHaveBeenCalledWith('plain-sign');
      expect(mockSecureConfig.encryptSecret).toHaveBeenCalledWith('plain-cert');
      expect(mockSecureConfig.encryptSecret).toHaveBeenCalledWith('plain-key');
      expect(mockPrisma.businessArcaCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tokenEncrypted: 'enc(plain-token)',
            signEncrypted: 'enc(plain-sign)',
            certificatePemEncrypted: 'enc(plain-cert)',
            privateKeyPemEncrypted: 'enc(plain-key)',
            isEnabled: true,
          }),
        })
      );
    });

    it('updates credentials preserving encrypted token/sign when not provided', async () => {
      mockPrisma.businessArcaCredential.findUnique.mockResolvedValue({
        tokenEncrypted: 'existing-token-encrypted',
        signEncrypted: 'existing-sign-encrypted',
      });
      mockPrisma.businessArcaCredential.upsert.mockResolvedValue({ id: 'cred-2' });

      await ArcaCredentialsService.upsertTenantCredentials({
        businessId: 'biz-update',
        cuit: '20999999999',
        environment: 'prod',
      });

      expect(mockPrisma.businessArcaCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            tokenEncrypted: 'existing-token-encrypted',
            signEncrypted: 'existing-sign-encrypted',
            environment: 'prod',
          }),
        })
      );
    });
  });

  describe('shouldRefreshToken', () => {
    it('returns false when token expiration is missing', () => {
      const result = (ArcaCredentialsService as any).shouldRefreshToken(null);
      expect(result).toBe(false);
    });

    it('returns false when token expiration is outside refresh window', () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
      mockEnv.invoice.arca.refreshMinutesBeforeExpiry = 20;

      const result = (ArcaCredentialsService as any).shouldRefreshToken(
        new Date(1700000000000 + 30 * 60 * 1000)
      );

      expect(result).toBe(false);
      nowSpy.mockRestore();
    });

    it('returns true when token expiration enters refresh window', () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
      mockEnv.invoice.arca.refreshMinutesBeforeExpiry = 20;

      const result = (ArcaCredentialsService as any).shouldRefreshToken(
        new Date(1700000000000 + 10 * 60 * 1000)
      );

      expect(result).toBe(true);
      nowSpy.mockRestore();
    });

    it('enforces minimum one-minute refresh window', () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
      mockEnv.invoice.arca.refreshMinutesBeforeExpiry = 0;

      const result = (ArcaCredentialsService as any).shouldRefreshToken(
        new Date(1700000000000 + 30 * 1000)
      );

      expect(result).toBe(true);
      nowSpy.mockRestore();
    });
  });
});
