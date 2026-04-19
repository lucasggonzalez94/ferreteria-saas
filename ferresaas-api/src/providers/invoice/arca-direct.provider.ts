import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { CreateVoucherInput, CreateVoucherResult, Voucher } from '../../types';
import { InvoiceProvider } from './invoice.provider.interface';

const WSFE_NAMESPACE = 'http://ar.gov.afip.dif.FEV1/';

const VOUCHER_TYPE_CODES: Record<'A' | 'B' | 'C', number> = {
  A: 1,
  B: 6,
  C: 11,
};

const IVA_CODE_BY_RATE: Record<string, number> = {
  '0': 3,
  '2.5': 9,
  '5': 8,
  '10.5': 4,
  '21': 5,
  '27': 6,
};

function formatAfipDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function parseAfipDate(value?: string): Date | undefined {
  if (!value || value.length !== 8) {
    return undefined;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function extractTag(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const match = xml.match(regex);
  if (!match) {
    return undefined;
  }

  return match[1]?.trim();
}

function extractErrorMessage(xml: string): string | undefined {
  const errMsg = extractTag(xml, 'ErrMsg');
  if (errMsg) {
    return errMsg;
  }

  const msg = extractTag(xml, 'Msg');
  if (msg) {
    return msg;
  }

  const fault = extractTag(xml, 'faultstring');
  if (fault) {
    return fault;
  }

  return undefined;
}

function normalizeRate(rate: number): string {
  if (Number.isInteger(rate)) {
    return `${rate}`;
  }

  return `${rate}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export class ArcaDirectProvider implements InvoiceProvider {
  private cuit: string;
  private token: string;
  private sign: string;
  private wsfeUrl: string;

  constructor() {
    if (!env.invoice.arca.cuit || !env.invoice.arca.token || !env.invoice.arca.sign) {
      throw new Error('ARCA credentials not configured (CUIT/TOKEN/SIGN)');
    }

    this.cuit = env.invoice.arca.cuit;
    this.token = env.invoice.arca.token;
    this.sign = env.invoice.arca.sign;
    this.wsfeUrl =
      env.invoice.arca.wsfeUrl || 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
  }

  private buildAuthXml(): string {
    return `<Auth><Token>${escapeXml(this.token)}</Token><Sign>${escapeXml(this.sign)}</Sign><Cuit>${this.cuit}</Cuit></Auth>`;
  }

  private async soapRequest(action: string, body: string): Promise<string> {
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;

    const response = await fetch(this.wsfeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${WSFE_NAMESPACE}${action}`,
      },
      body: envelope,
    });

    const xml = await response.text();
    if (!response.ok) {
      throw new Error(`ARCA SOAP HTTP ${response.status}: ${extractErrorMessage(xml) || 'Unknown error'}`);
    }

    return xml;
  }

  private async getLastAuthorizedNumber(pointOfSale: number, voucherTypeCode: number): Promise<number> {
    const xml = await this.soapRequest(
      'FECompUltimoAutorizado',
      `<FECompUltimoAutorizado xmlns="${WSFE_NAMESPACE}">
        ${this.buildAuthXml()}
        <PtoVta>${pointOfSale}</PtoVta>
        <CbteTipo>${voucherTypeCode}</CbteTipo>
      </FECompUltimoAutorizado>`
    );

    const value = extractTag(xml, 'CbteNro');
    const last = value ? Number(value) : 0;
    return Number.isFinite(last) ? last : 0;
  }

  async createVoucher(input: CreateVoucherInput): Promise<CreateVoucherResult> {
    const voucherTypeCode = VOUCHER_TYPE_CODES[input.voucherType];

    if (!voucherTypeCode) {
      return {
        success: false,
        errorCategory: 'fiscal',
        error: `Unsupported voucher type: ${input.voucherType}`,
      };
    }

    try {
      const lastNumber = await this.getLastAuthorizedNumber(input.pointOfSale, voucherTypeCode);
      const nextNumber = lastNumber + 1;
      const cbteDate = formatAfipDate(new Date());

      const customerDocType = input.customer?.cuit ? 80 : 99;
      const customerDocNumber = input.customer?.cuit ? input.customer.cuit.replaceAll(/\D/g, '') : '0';

      const ivaTotals = new Map<number, number>();
      for (const item of input.items) {
        const rateKey = normalizeRate(item.taxRate);
        const ivaId = IVA_CODE_BY_RATE[rateKey];
        if (!ivaId || item.taxRate <= 0) {
          continue;
        }

        const netAmount = item.total;
        const amount = Number((netAmount * item.taxRate) / 100);
        const previous = ivaTotals.get(ivaId) || 0;
        ivaTotals.set(ivaId, previous + amount);
      }

      const ivaArrayXml = Array.from(ivaTotals.entries())
        .map(([id, amount]) => `<AlicIva><Id>${id}</Id><BaseImp>${input.subtotal.toFixed(2)}</BaseImp><Importe>${amount.toFixed(2)}</Importe></AlicIva>`)
        .join('');

      const ivaXml = ivaArrayXml ? `<Iva>${ivaArrayXml}</Iva>` : '';

      const xml = await this.soapRequest(
        'FECAESolicitar',
        `<FECAESolicitar xmlns="${WSFE_NAMESPACE}">
          ${this.buildAuthXml()}
          <FeCAEReq>
            <FeCabReq>
              <CantReg>1</CantReg>
              <PtoVta>${input.pointOfSale}</PtoVta>
              <CbteTipo>${voucherTypeCode}</CbteTipo>
            </FeCabReq>
            <FeDetReq>
              <FECAEDetRequest>
                <Concepto>1</Concepto>
                <DocTipo>${customerDocType}</DocTipo>
                <DocNro>${customerDocNumber}</DocNro>
                <CbteDesde>${nextNumber}</CbteDesde>
                <CbteHasta>${nextNumber}</CbteHasta>
                <CbteFch>${cbteDate}</CbteFch>
                <ImpTotal>${input.total.toFixed(2)}</ImpTotal>
                <ImpTotConc>0.00</ImpTotConc>
                <ImpNeto>${input.subtotal.toFixed(2)}</ImpNeto>
                <ImpOpEx>0.00</ImpOpEx>
                <ImpIVA>${input.taxAmount.toFixed(2)}</ImpIVA>
                <ImpTrib>0.00</ImpTrib>
                <MonId>PES</MonId>
                <MonCotiz>1</MonCotiz>
                ${ivaXml}
              </FECAEDetRequest>
            </FeDetReq>
          </FeCAEReq>
        </FECAESolicitar>`
      );

      const cae = extractTag(xml, 'CAE');
      const caeFchVto = extractTag(xml, 'CAEFchVto');
      const result = extractTag(xml, 'Resultado');
      const errorMessage = extractErrorMessage(xml);

      if (!cae || result !== 'A') {
        return {
          success: false,
          errorCategory: 'fiscal',
          error: errorMessage || 'ARCA rejected voucher request',
        };
      }

      return {
        success: true,
        cae,
        caeExpiry: parseAfipDate(caeFchVto),
        number: nextNumber,
        qrData: `https://www.afip.gob.ar/fe/qr/?p=${cae}`,
        pdfUrl: undefined,
      };
    } catch (error) {
      logger.error({ error, input }, 'Failed to create voucher with ARCA direct');
      return {
        success: false,
        errorCategory: 'technical',
        error: error instanceof Error ? error.message : 'Unknown ARCA error',
      };
    }
  }

  async getVoucher(_voucherId: string): Promise<Voucher | null> {
    return null;
  }

  async downloadPdf(_voucherId: string): Promise<Buffer | null> {
    return null;
  }
}
