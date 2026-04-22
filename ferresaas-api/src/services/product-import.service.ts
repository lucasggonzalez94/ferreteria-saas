import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { ProductService } from './product.service';

export type FileFormat = 'csv' | 'xlsx';

const EXPECTED_COLUMNS = [
  'nombre', 'codigo_barras', 'descripcion', 'categoria', 'marca', 
  'unidad', 'precio_costo', 'precio_venta', 'IVA', 'stock_minimo', 
  'stock_inicial', 'es_fraccionable', 'modo_precio', 'margen', 'markup', 
  'precio_fijo', 'paso_redondeo', 'metodo_costo'
];

const REQUIRED_COLUMNS = ['nombre', 'categoria', 'marca', 'unidad', 'precio_costo', 'precio_venta', 'IVA'];
const COST_METHOD_VALUES = new Set(['avg_weighted', 'last_cost']);
const BOOLEAN_TEXT_VALUES = new Set(['true', 'false', '1', '0', 'yes', 'no', 'si', 'sí', 's', 'n']);

type IssueSeverity = 'error' | 'warning';

interface ImportIssue {
  row: number;
  field: string;
  code: string;
  message: string;
  value?: string;
  severity: IssueSeverity;
  blocking: boolean;
}

interface NormalizedRow {
  name: string;
  barcode?: string;
  description?: string;
  categoryName: string;
  brandName: string;
  unit: 'u' | 'mt' | 'kg' | 'lt';
  isFractional: boolean;
  cost: number;
  price: number;
  taxRate: number;
  marginPercent?: number;
  minStock?: number;
  initialStock?: number;
  pricingMode: 'fixed' | 'margin' | 'markup' | 'suggest';
  targetMargin?: number;
  targetMarkup?: number;
  priceLocked: boolean;
  roundingStep: number;
  costMethod: 'avg_weighted' | 'last_cost';
}

interface RowValidationResult {
  row: number;
  raw: Record<string, string>;
  issues: ImportIssue[];
  importable: boolean;
  normalized?: NormalizedRow;
}

interface Summary {
  totalRows: number;
  validRows: number;
  rowsWithWarnings: number;
  rowsWithErrors: number;
  importableRows: number;
  blockingRows: number;
}

interface PreviewResult {
  summary: Summary;
  rows: RowValidationResult[];
}

interface ExecuteResult {
  summary: Summary;
  createdProducts: number;
  createdCategories: number;
  createdBrands: number;
  rejectedRows: Array<{
    row: number;
    reasons: string[];
  }>;
}

const parseOptionalText = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeText = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const parseOptionalNumber = (value?: string): number | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (!value || !value.trim()) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  return ['true', '1', 'yes', 'si', 's'].includes(normalized);
};

const normalizeUnit = (value: string | undefined): 'u' | 'mt' | 'kg' | 'lt' | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (['u', 'unidad'].includes(normalized)) return 'u';
  if (['mt', 'metro'].includes(normalized)) return 'mt';
  if (['kg', 'kilo'].includes(normalized)) return 'kg';
  if (['lt', 'litro'].includes(normalized)) return 'lt';
  return undefined;
};

const normalizePricingMode = (value: string | undefined): 'fixed' | 'margin' | 'markup' | 'suggest' | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (['fixed', 'fijo'].includes(normalized)) return 'fixed';
  if (['margin', 'margen'].includes(normalized)) return 'margin';
  if (['markup'].includes(normalized)) return 'markup';
  if (['suggest', 'sugerido'].includes(normalized)) return 'suggest';
  return undefined;
};

const normalizeCostMethod = (value: string | undefined): 'avg_weighted' | 'last_cost' | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (['avg_weighted', 'ponderado'].includes(normalized)) return 'avg_weighted';
  if (['last_cost', 'último_costo', 'ultimo_costo'].includes(normalized)) return 'last_cost';
  return undefined;
};

const detectFileFormat = (buffer: Buffer): FileFormat => {
  const signature = buffer.slice(0, 4);
  const xlsxSignature = [0x50, 0x4B, 0x03, 0x04];
  const isXlsx = xlsxSignature.every((byte, index) => signature[index] === byte);
  return isXlsx ? 'xlsx' : 'csv';
};

const parseCsvRecords = (buffer: Buffer): Record<string, string>[] => {
  const fileContent = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    escape: '"',
  });
};

const parseXlsxRecords = (buffer: Buffer): Record<string, string>[] => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellNF: true });
  
  if (workbook.SheetNames.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'El archivo XLSX no contiene hojas.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

  if (records.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'La hoja no contiene filas para importar.');
  }

  return records.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.trim();
      if (cleanKey) {
        normalized[cleanKey] = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
      }
    }
    return normalized;
  });
};

const parseFile = (buffer: Buffer): Record<string, string>[] => {
  const format = detectFileFormat(buffer);
  
  if (format === 'xlsx') {
    return parseXlsxRecords(buffer);
  }
  
  return parseCsvRecords(buffer);
};

export class ProductImportService {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  async preview(businessId: string, fileBuffer: Buffer): Promise<PreviewResult> {
    return this.analyzeCsv(businessId, fileBuffer);
  }

  async execute(businessId: string, userId: string, fileBuffer: Buffer): Promise<ExecuteResult> {
    const previewResult = await this.analyzeCsv(businessId, fileBuffer);
    const importableRows = previewResult.rows.filter((row) => row.importable && row.normalized);

    const categoriesByName = await this.loadCategoriesByName(businessId);
    const brandsByName = await this.loadBrandsByName(businessId);

    const rejectedRows: Array<{ row: number; reasons: string[] }> = [];
    let createdProducts = 0;
    let createdCategories = 0;
    let createdBrands = 0;

    for (const row of importableRows) {
      const normalized = row.normalized!;

      try {
        const categoryId = await this.getOrCreateCategoryId(
          businessId,
          userId,
          normalized.categoryName,
          categoriesByName
        );
        if (categoryId.wasCreated) {
          createdCategories++;
        }

        const brandId = await this.getOrCreateBrandId(
          businessId,
          userId,
          normalized.brandName,
          brandsByName
        );
        if (brandId.wasCreated) {
          createdBrands++;
        }

        await this.productService.create(businessId, userId, {
          name: normalized.name,
          barcode: normalized.barcode,
          description: normalized.description,
          categoryId: categoryId.id,
          brandId: brandId.id,
          unit: normalized.unit,
          isFractional: normalized.isFractional,
          cost: normalized.cost,
          price: normalized.price,
          taxRate: normalized.taxRate,
          marginPercent: normalized.marginPercent,
          minStock: normalized.minStock,
          initialStock: normalized.initialStock,
          pricingMode: normalized.pricingMode,
          targetMargin: normalized.targetMargin,
          targetMarkup: normalized.targetMarkup,
          priceLocked: normalized.priceLocked,
          roundingStep: normalized.roundingStep,
          costMethod: normalized.costMethod,
        });

        createdProducts++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown import error';
        rejectedRows.push({
          row: row.row,
          reasons: [message],
        });
      }
    }

    return {
      summary: previewResult.summary,
      createdProducts,
      createdCategories,
      createdBrands,
      rejectedRows,
    };
  }

  private async analyzeCsv(businessId: string, fileBuffer: Buffer): Promise<PreviewResult> {
    const format = detectFileFormat(fileBuffer);
    const formatName = format === 'xlsx' ? 'XLSX' : 'CSV';

    let records: Record<string, string>[];
    try {
      records = parseFile(fileBuffer);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(400, 'INVALID_FILE', `No se pudo procesar el archivo ${formatName}. Error: ${message}`);
    }

    if (!records.length) {
      throw new AppError(400, 'EMPTY_FILE', `El archivo ${formatName} no contiene filas para importar.`);
    }

    const headerColumns = Object.keys(records[0]);
    const expectedColumnCount = EXPECTED_COLUMNS.length;

    if (headerColumns.length !== expectedColumnCount) {
      throw new AppError(400, 'INVALID_HEADER', 
        `El archivo debe tener ${expectedColumnCount} columnas. Encontradas: ${headerColumns.length}. `
        + `Columnas esperadas: ${EXPECTED_COLUMNS.join(', ')}`);
    }

    const missingColumns = EXPECTED_COLUMNS.filter(col => !headerColumns.includes(col));
    if (missingColumns.length > 0) {
      throw new AppError(400, 'MISSING_COLUMNS', 
        `Faltan las siguientes columnas: ${missingColumns.join(', ')}`);
    }

    const extraColumns = headerColumns.filter(col => !EXPECTED_COLUMNS.includes(col));
    if (extraColumns.length > 0) {
      throw new AppError(400, 'EXTRA_COLUMNS', 
        `Columnas no reconocidas: ${extraColumns.join(', ')}. `
        + `Usa solo: ${EXPECTED_COLUMNS.join(', ')}`);
    }

    console.log(`Parsed ${formatName} records:`);
    records.forEach((record, idx) => {
      console.log(`Row ${idx + 1}:`, JSON.stringify(record));
      console.log(`Row ${idx + 1} keys:`, Object.keys(record));
    });

    const existingProducts = await prisma.product.findMany({
      where: { businessId },
      select: {
        barcode: true,
        name: true,
        brand: {
          select: {
            name: true,
          },
        },
      },
    });

    const existingBarcodes = new Set(
      existingProducts
        .map((product) => product.barcode?.trim())
        .filter((barcode): barcode is string => Boolean(barcode))
    );

    const existingNameBrandKeys = new Set(
      existingProducts
        .filter((product) => product.brand?.name)
        .map((product) => `${normalizeText(product.name)}|${normalizeText(product.brand!.name)}`)
    );

    const seenBarcodesInFile = new Set<string>();
    const seenNameBrandInFile = new Set<string>();

    const rows: RowValidationResult[] = [];

    records.forEach((rawRow, index) => {
      const rowNumber = index + 1;
      const row = this.alignShiftedFixedRow(this.normalizeRawRow(rawRow));
      const rowKeys = Object.keys(row);
      const issues: ImportIssue[] = [];

      if (rowKeys.length !== EXPECTED_COLUMNS.length) {
        const missingCols: string[] = [];
        EXPECTED_COLUMNS.forEach(col => {
          if (!rowKeys.includes(col)) {
            missingCols.push(col);
          }
        });
        
        issues.push({
          row: rowNumber,
          field: '_column_count',
          code: 'COLUMN_COUNT_MISMATCH',
          message: `La fila tiene ${rowKeys.length} columnas pero debe tener ${EXPECTED_COLUMNS.length}. Faltan: ${missingCols.join(', ')}`,
          severity: 'error',
          blocking: true,
        });
      }

      for (const requiredColumn of REQUIRED_COLUMNS) {
        if (!row[requiredColumn] || !row[requiredColumn].trim()) {
          issues.push({
            row: rowNumber,
            field: requiredColumn,
            code: 'REQUIRED_FIELD',
            message: `El campo ${requiredColumn} es obligatorio. Complete la celda.`,
            severity: 'error',
            blocking: true,
          });
        }
      }

      const normalized = this.buildNormalizedRow(row, rowNumber, issues);

      if (normalized) {
        if (normalized.barcode) {
          if (existingBarcodes.has(normalized.barcode)) {
            issues.push({
              row: rowNumber,
              field: 'codigo_barras',
              code: 'PRODUCT_ALREADY_EXISTS',
              message: 'Ya existe un producto en este negocio con el mismo código de barras.',
              value: normalized.barcode,
              severity: 'warning',
              blocking: true,
            });
          }

          if (seenBarcodesInFile.has(normalized.barcode)) {
            issues.push({
              row: rowNumber,
              field: 'barcode',
              code: 'DUPLICATE_IN_FILE',
              message: 'El código de barras está repetido en el archivo.',
              value: normalized.barcode,
              severity: 'warning',
              blocking: true,
            });
          } else {
            seenBarcodesInFile.add(normalized.barcode);
          }
        } else {
          const nameBrandKey = `${normalizeText(normalized.name)}|${normalizeText(normalized.brandName)}`;

          if (existingNameBrandKeys.has(nameBrandKey)) {
            issues.push({
              row: rowNumber,
              field: 'name',
              code: 'PRODUCT_ALREADY_EXISTS',
              message: 'Ya existe un producto en este negocio con el mismo nombre y marca.',
              value: `${normalized.name} / ${normalized.brandName}`,
              severity: 'warning',
              blocking: true,
            });
          }

          if (seenNameBrandInFile.has(nameBrandKey)) {
            issues.push({
              row: rowNumber,
              field: 'name',
              code: 'DUPLICATE_IN_FILE',
              message: 'La combinación nombre + marca está repetida en el archivo.',
              value: `${normalized.name} / ${normalized.brandName}`,
              severity: 'warning',
              blocking: true,
            });
          } else {
            seenNameBrandInFile.add(nameBrandKey);
          }
        }
      }

      const importable = issues.every((issue) => !issue.blocking);

      rows.push({
        row: rowNumber,
        raw: row,
        issues,
        importable,
        normalized: importable ? normalized ?? undefined : undefined,
      });
    });

    const summary = this.buildSummary(rows);

    return {
      summary,
      rows,
    };
  }

  private normalizeRawRow(rawRow: Record<string, string>): Record<string, string> {
    return Object.entries(rawRow).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key.trim()] = typeof value === 'string' ? value.trim() : '';
      return acc;
    }, {});
  }

  private alignShiftedFixedRow(row: Record<string, string>): Record<string, string> {
    const normalizedPricingMode = (row.modo_precio ?? '').trim().toLowerCase();
    const normalizedMarkup = (row.markup ?? '').trim().toLowerCase();
    const roundedStepValue = (row.paso_redondeo ?? '').trim();
    const fixedPriceValue = (row.precio_fijo ?? '').trim();
    const costMethodValue = (row.metodo_costo ?? '').trim();

    const looksShiftedByOne =
      normalizedPricingMode === 'fixed' &&
      !costMethodValue &&
      COST_METHOD_VALUES.has(roundedStepValue) &&
      /^\d+$/.test(fixedPriceValue) &&
      BOOLEAN_TEXT_VALUES.has(normalizedMarkup);

    if (!looksShiftedByOne) {
      return row;
    }

    return {
      ...row,
      markup: '',
      precio_fijo: row.markup ?? '',
      paso_redondeo: row.precio_fijo ?? '',
      metodo_costo: row.paso_redondeo ?? '',
    };
  }

  private buildNormalizedRow(
    row: Record<string, string>,
    rowNumber: number,
    issues: ImportIssue[]
  ): NormalizedRow | null {
    const name = parseOptionalText(row.nombre);
    const categoryName = parseOptionalText(row.categoria);
    const brandName = parseOptionalText(row.marca);
    const barcode = parseOptionalText(row.codigo_barras);
    const description = parseOptionalText(row.descripcion);

    const unit = normalizeUnit(row.unidad);
    if (row.unidad && !unit) {
      issues.push({
        row: rowNumber,
        field: 'unidad',
        code: 'INVALID_UNIT',
        message: 'Unidad inválida. Valores permitidos: u (unidad), mt (metro), kg (kilo), lt (litro).',
        value: row.unidad,
        severity: 'error',
        blocking: true,
      });
    }

    const cost = parseOptionalNumber(row.precio_costo);
    if (row.precio_costo && (cost === undefined || cost <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'precio_costo',
        code: 'INVALID_COST',
        message: 'El costo debe ser un número mayor a 0.',
        value: row.precio_costo,
        severity: 'error',
        blocking: true,
      });
    }

    const price = parseOptionalNumber(row.precio_venta);
    if (row.precio_venta && (price === undefined || price <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'precio_venta',
        code: 'INVALID_PRICE',
        message: 'El precio debe ser un número mayor a 0.',
        value: row.precio_venta,
        severity: 'error',
        blocking: true,
      });
    }

    const taxRate = parseOptionalNumber(row.IVA);
    if (row.IVA && (taxRate === undefined || taxRate < 0 || taxRate > 100)) {
      issues.push({
        row: rowNumber,
        field: 'IVA',
        code: 'INVALID_TAX_RATE',
        message: 'IVA inválido. Debe estar entre 0 y 100.',
        value: row.IVA,
        severity: 'error',
        blocking: true,
      });
    }

    const minStock = parseOptionalNumber(row.stock_minimo);
    if (minStock !== undefined && minStock < 0) {
      issues.push({
        row: rowNumber,
        field: 'stock_minimo',
        code: 'INVALID_MIN_STOCK',
        message: 'El stock mínimo no puede ser negativo.',
        value: row.stock_minimo,
        severity: 'error',
        blocking: true,
      });
    }

    const initialStock = parseOptionalNumber(row.stock_inicial);
    if (initialStock !== undefined && initialStock < 0) {
      issues.push({
        row: rowNumber,
        field: 'stock_inicial',
        code: 'INVALID_INITIAL_STOCK',
        message: 'El stock inicial no puede ser negativo.',
        value: row.stock_inicial,
        severity: 'error',
        blocking: true,
      });
    }

    const marginPercent = parseOptionalNumber(row.margen);
    if (marginPercent !== undefined && (marginPercent <= 0 || marginPercent >= 100)) {
      issues.push({
        row: rowNumber,
        field: 'margen',
        code: 'INVALID_MARGIN_PERCENT',
        message: 'El margen debe ser mayor a 0 y menor a 100.',
        value: row.margen,
        severity: 'error',
        blocking: true,
      });
    }

    const pricingMode = normalizePricingMode(row.modo_precio);
    if (row.modo_precio && !pricingMode) {
      issues.push({
        row: rowNumber,
        field: 'modo_precio',
        code: 'INVALID_PRICING_MODE',
        message: 'Modo de precio inválido. Valores permitidos: fixed (fijo), margin (margen), markup, suggest (sugerido).',
        value: row.modo_precio,
        severity: 'error',
        blocking: true,
      });
    }

    const targetMargin = parseOptionalNumber(row.margen);
    if (row.margen && (targetMargin === undefined || targetMargin <= 0 || targetMargin >= 100)) {
      issues.push({
        row: rowNumber,
        field: 'margen',
        code: 'INVALID_TARGET_MARGIN',
        message: 'El margen objetivo debe ser mayor a 0 y menor a 100.',
        value: row.margen,
        severity: 'error',
        blocking: true,
      });
    }

    const targetMarkup = parseOptionalNumber(row.markup);
    if (row.markup && (targetMarkup === undefined || targetMarkup <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'markup',
        code: 'INVALID_TARGET_MARKUP',
        message: 'El markup debe ser mayor a 0.',
        value: row.markup,
        severity: 'error',
        blocking: true,
      });
    }

    const roundingStep = parseOptionalNumber(row.paso_redondeo);
    if (roundingStep !== undefined && (!Number.isInteger(roundingStep) || roundingStep <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'paso_redondeo',
        code: 'INVALID_ROUNDING_STEP',
        message: 'El paso de redondeo debe ser un entero mayor a 0.',
        value: row.paso_redondeo,
        severity: 'error',
        blocking: true,
      });
    }

    const costMethod = normalizeCostMethod(row.metodo_costo);
    if (row.metodo_costo && !costMethod) {
      issues.push({
        row: rowNumber,
        field: 'metodo_costo',
        code: 'INVALID_COST_METHOD',
        message: 'Método de costo inválido. Valores: avg_weighted (ponderado), last_cost (último costo).',
        value: row.metodo_costo,
        severity: 'error',
        blocking: true,
      });
    }

    if (!name || !categoryName || !brandName || !unit || cost === undefined || price === undefined || taxRate === undefined) {
      return null;
    }

    return {
      name,
      barcode,
      description,
      categoryName,
      brandName,
      unit,
      isFractional: parseBoolean(row.es_fraccionable, false),
      cost,
      price,
      taxRate,
      marginPercent,
      minStock,
      initialStock,
      pricingMode: pricingMode || 'margin',
      targetMargin,
      targetMarkup,
      priceLocked: parseBoolean(row.precio_fijo, false),
      roundingStep: roundingStep ?? 10,
      costMethod: costMethod || 'avg_weighted',
    };
  }

  private buildSummary(rows: RowValidationResult[]): Summary {
    let validRows = 0;
    let rowsWithWarnings = 0;
    let rowsWithErrors = 0;
    let importableRows = 0;

    for (const row of rows) {
      const hasError = row.issues.some((issue) => issue.severity === 'error');
      const hasWarning = row.issues.some((issue) => issue.severity === 'warning');

      if (!hasError && !hasWarning) {
        validRows++;
      }
      if (hasWarning) {
        rowsWithWarnings++;
      }
      if (hasError) {
        rowsWithErrors++;
      }
      if (row.importable) {
        importableRows++;
      }
    }

    return {
      totalRows: rows.length,
      validRows,
      rowsWithWarnings,
      rowsWithErrors,
      importableRows,
      blockingRows: rows.length - importableRows,
    };
  }

  private async loadCategoriesByName(businessId: string): Promise<Map<string, string>> {
    const categories = await prisma.category.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });

    return new Map(categories.map((category) => [normalizeText(category.name), category.id]));
  }

  private async loadBrandsByName(businessId: string): Promise<Map<string, string>> {
    const brands = await prisma.brand.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });

    return new Map(brands.map((brand) => [normalizeText(brand.name), brand.id]));
  }

  private async getOrCreateCategoryId(
    businessId: string,
    _userId: string,
    categoryName: string,
    cache: Map<string, string>
  ): Promise<{ id: string; wasCreated: boolean }> {
    const key = normalizeText(categoryName);
    const existing = cache.get(key);
    if (existing) {
      return { id: existing, wasCreated: false };
    }

    try {
      const created = await prisma.category.create({
        data: {
          businessId,
          name: categoryName.trim(),
        },
      });
      cache.set(key, created.id);
      return { id: created.id, wasCreated: true };
    } catch (error) {
      const fallback = await prisma.category.findFirst({
        where: {
          businessId,
          name: {
            equals: categoryName.trim(),
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (fallback) {
        cache.set(key, fallback.id);
        return { id: fallback.id, wasCreated: false };
      }

      throw error;
    }
  }

  private async getOrCreateBrandId(
    businessId: string,
    _userId: string,
    brandName: string,
    cache: Map<string, string>
  ): Promise<{ id: string; wasCreated: boolean }> {
    const key = normalizeText(brandName);
    const existing = cache.get(key);
    if (existing) {
      return { id: existing, wasCreated: false };
    }

    try {
      const created = await prisma.brand.create({
        data: {
          businessId,
          name: brandName.trim(),
        },
      });
      cache.set(key, created.id);
      return { id: created.id, wasCreated: true };
    } catch (error) {
      const fallback = await prisma.brand.findFirst({
        where: {
          businessId,
          name: {
            equals: brandName.trim(),
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (fallback) {
        cache.set(key, fallback.id);
        return { id: fallback.id, wasCreated: false };
      }

      throw error;
    }
  }
}
