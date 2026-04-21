import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env';

const execFileAsync = promisify(execFile);

const DEFAULT_WSAA_HOMO = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
const DEFAULT_SERVICE_NAME = 'wsfe';

function extractXmlTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const match = xml.match(regex);
  return match?.[1]?.trim() || null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function getIsoDateWithOffset(date: Date): string {
  const pad = (value: number): string => `${Math.abs(value)}`.padStart(2, '0');
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  const timezoneOffset = -date.getTimezoneOffset();
  const sign = timezoneOffset >= 0 ? '+' : '-';
  const tzHours = pad(Math.trunc(timezoneOffset / 60));
  const tzMinutes = pad(timezoneOffset % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${tzHours}:${tzMinutes}`;
}

async function buildCmsBase64(input: {
  certificatePem: string;
  privateKeyPem: string;
  serviceName: string;
}): Promise<string> {
  const opensslBin = env.invoice.arca.opensslBin || 'openssl';
  const workingDirectory = await fs.mkdtemp(join(tmpdir(), 'arca-wsaa-'));

  const certPath = join(workingDirectory, 'certificate.pem');
  const keyPath = join(workingDirectory, 'private-key.pem');
  const traPath = join(workingDirectory, 'tra.xml');
  const cmsPath = join(workingDirectory, 'tra.cms');

  const now = new Date();
  const generationTime = getIsoDateWithOffset(new Date(now.getTime() - 5 * 60 * 1000));
  const expirationTime = getIsoDateWithOffset(new Date(now.getTime() + 10 * 60 * 1000));
  const uniqueId = Math.floor(now.getTime() / 1000);

  const traXml = `<?xml version="1.0" encoding="UTF-8"?>\n<loginTicketRequest version="1.0">\n  <header>\n    <uniqueId>${uniqueId}</uniqueId>\n    <generationTime>${generationTime}</generationTime>\n    <expirationTime>${expirationTime}</expirationTime>\n  </header>\n  <service>${input.serviceName}</service>\n</loginTicketRequest>`;

  try {
    await fs.writeFile(certPath, input.certificatePem, 'utf8');
    await fs.writeFile(keyPath, input.privateKeyPem, 'utf8');
    await fs.writeFile(traPath, traXml, 'utf8');

    await execFileAsync(opensslBin, [
      'smime',
      '-sign',
      '-in',
      traPath,
      '-signer',
      certPath,
      '-inkey',
      keyPath,
      '-nodetach',
      '-outform',
      'DER',
      '-out',
      cmsPath,
    ]);

    const cmsBuffer = await fs.readFile(cmsPath);
    return cmsBuffer.toString('base64');
  } finally {
    await fs.rm(workingDirectory, { recursive: true, force: true });
  }
}

export interface WsaaLoginResult {
  token: string;
  sign: string;
  expiresAt: Date;
}

export class ArcaWsaaService {
  static async loginCms(input: {
    certificatePem: string;
    privateKeyPem: string;
    serviceName?: string;
    wsaaUrl?: string;
  }): Promise<WsaaLoginResult> {
    const serviceName = input.serviceName || DEFAULT_SERVICE_NAME;
    const wsaaUrl = input.wsaaUrl || DEFAULT_WSAA_HOMO;

    const cmsBase64 = await buildCmsBase64({
      certificatePem: input.certificatePem,
      privateKeyPem: input.privateKeyPem,
      serviceName,
    });

    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>\n<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">\n  <soapenv:Header/>\n  <soapenv:Body>\n    <wsaa:loginCms>\n      <wsaa:in0>${cmsBase64}</wsaa:in0>\n    </wsaa:loginCms>\n  </soapenv:Body>\n</soapenv:Envelope>`;

    const response = await fetch(wsaaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'loginCms',
      },
      body: soapBody,
    });

    const responseBody = await response.text();
    if (!response.ok) {
      const fault = extractXmlTag(responseBody, 'faultstring');
      throw new Error(`WSAA loginCms HTTP ${response.status}${fault ? `: ${fault}` : ''}`);
    }

    const loginCmsReturnXml = extractXmlTag(responseBody, 'loginCmsReturn');
    if (!loginCmsReturnXml) {
      throw new Error('WSAA response without loginCmsReturn');
    }

    const normalizedLoginCmsReturnXml = loginCmsReturnXml.includes('&lt;')
      ? decodeXmlEntities(loginCmsReturnXml)
      : loginCmsReturnXml;

    const token = extractXmlTag(normalizedLoginCmsReturnXml, 'token');
    const sign = extractXmlTag(normalizedLoginCmsReturnXml, 'sign');
    const expirationTime = extractXmlTag(normalizedLoginCmsReturnXml, 'expirationTime');

    if (!token || !sign || !expirationTime) {
      throw new Error('WSAA response without token/sign/expirationTime');
    }

    const expiresAt = new Date(expirationTime);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error('Invalid WSAA expirationTime');
    }

    return {
      token,
      sign,
      expiresAt,
    };
  }
}
