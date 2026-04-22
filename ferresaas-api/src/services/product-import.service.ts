import { parse } from 'csv-parse/sync';
import { prisma } from '../config/database';
import { AppError } from '../utils/response';
import { ProductService } from './product.service';

const REQUIRED_COLUMNS = ['name', 'category', 'brand', 'unit', 'cost', 'price', 'taxRate'];
const VALID_UNITS = new Set(['u', 'mt', 'kg', 'lt']);
const VALID_PRICING_MODES = new Set(['fixed', 'margin', 'markup', 'suggest']);
const VALID_COST_METHODS = new Set(['avg_weighted', 'last_cost']);

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
    const fileContent = fileBuffer.toString('utf-8').replace(/^\uFEFF/, '');

    let records: Record<string, string>[];
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
        relax_quotes: true,
      });
    } catch (error) {
      throw new AppError(400, 'INVALID_CSV', 'No se pudo procesar el CSV. Verifica el formato del archivo.');
    }

    if (!records.length) {
      throw new AppError(400, 'EMPTY_FILE', 'El archivo CSV no contiene filas para importar.');
    }

    console.log('Parsed records:');
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
      const rowNumber = index + 2;
      const row = this.normalizeRawRow(rawRow);
      const issues: ImportIssue[] = [];

      for (const requiredColumn of REQUIRED_COLUMNS) {
        if (!row[requiredColumn] || !row[requiredColumn].trim()) {
          issues.push({
            row: rowNumber,
            field: requiredColumn,
            code: 'REQUIRED_FIELD',
            message: `El campo ${requiredColumn} es obligatorio.`,
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
              field: 'barcode',
              code: 'PRODUCT_ALREADY_EXISTS',
              message: 'Ya existe un producto en este tenant con el mismo código de barras.',
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
              message: 'Ya existe un producto en este tenant con el mismo nombre y marca.',
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

  private buildNormalizedRow(
    row: Record<string, string>,
    rowNumber: number,
    issues: ImportIssue[]
  ): NormalizedRow | null {
    const name = parseOptionalText(row.name);
    const categoryName = parseOptionalText(row.category);
    const brandName = parseOptionalText(row.brand);
    const barcode = parseOptionalText(row.barcode);
    const description = parseOptionalText(row.description);

    const unitValue = parseOptionalText(row.unit)?.toLowerCase();
    const unit = unitValue as NormalizedRow['unit'] | undefined;
    if (unitValue && !VALID_UNITS.has(unitValue)) {
      issues.push({
        row: rowNumber,
        field: 'unit',
        code: 'INVALID_UNIT',
        message: 'Unidad inválida. Valores permitidos: u, mt, kg, lt.',
        value: row.unit,
        severity: 'error',
        blocking: true,
      });
    }

    const cost = parseOptionalNumber(row.cost);
    if (row.cost && (cost === undefined || cost <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'cost',
        code: 'INVALID_COST',
        message: 'El costo debe ser un número mayor a 0.',
        value: row.cost,
        severity: 'error',
        blocking: true,
      });
    }

    const price = parseOptionalNumber(row.price);
    if (row.price && (price === undefined || price <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'price',
        code: 'INVALID_PRICE',
        message: 'El precio debe ser un número mayor a 0.',
        value: row.price,
        severity: 'error',
        blocking: true,
      });
    }

    const taxRate = parseOptionalNumber(row.taxRate);
    if (row.taxRate && (taxRate === undefined || taxRate < 0 || taxRate > 100)) {
      issues.push({
        row: rowNumber,
        field: 'taxRate',
        code: 'INVALID_TAX_RATE',
        message: 'IVA inválido. Debe estar entre 0 y 100.',
        value: row.taxRate,
        severity: 'error',
        blocking: true,
      });
    }

    const minStock = parseOptionalNumber(row.minStock);
    if (minStock !== undefined && minStock < 0) {
      issues.push({
        row: rowNumber,
        field: 'minStock',
        code: 'INVALID_MIN_STOCK',
        message: 'El stock mínimo no puede ser negativo.',
        value: row.minStock,
        severity: 'error',
        blocking: true,
      });
    }

    const initialStock = parseOptionalNumber(row.initialStock);
    if (initialStock !== undefined && initialStock < 0) {
      issues.push({
        row: rowNumber,
        field: 'initialStock',
        code: 'INVALID_INITIAL_STOCK',
        message: 'El stock inicial no puede ser negativo.',
        value: row.initialStock,
        severity: 'error',
        blocking: true,
      });
    }

    const marginPercent = parseOptionalNumber(row.marginPercent);
    if (marginPercent !== undefined && (marginPercent <= 0 || marginPercent >= 100)) {
      issues.push({
        row: rowNumber,
        field: 'marginPercent',
        code: 'INVALID_MARGIN_PERCENT',
        message: 'El margen debe ser mayor a 0 y menor a 100.',
        value: row.marginPercent,
        severity: 'error',
        blocking: true,
      });
    }

    const pricingModeValue = parseOptionalText(row.pricingMode)?.toLowerCase() || 'margin';
    const pricingMode = pricingModeValue as NormalizedRow['pricingMode'];
    if (!VALID_PRICING_MODES.has(pricingModeValue)) {
      issues.push({
        row: rowNumber,
        field: 'pricingMode',
        code: 'INVALID_PRICING_MODE',
        message: 'pricingMode inválido. Valores permitidos: fixed, margin, markup, suggest.',
        value: row.pricingMode,
        severity: 'error',
        blocking: true,
      });
    }

    const targetMargin = parseOptionalNumber(row.targetMargin);
    if (targetMargin !== undefined && (targetMargin <= 0 || targetMargin >= 100)) {
      issues.push({
        row: rowNumber,
        field: 'targetMargin',
        code: 'INVALID_TARGET_MARGIN',
        message: 'targetMargin debe ser mayor a 0 y menor a 100.',
        value: row.targetMargin,
        severity: 'error',
        blocking: true,
      });
    }

    const targetMarkup = parseOptionalNumber(row.targetMarkup);
    if (targetMarkup !== undefined && targetMarkup <= 0) {
      issues.push({
        row: rowNumber,
        field: 'targetMarkup',
        code: 'INVALID_TARGET_MARKUP',
        message: 'targetMarkup debe ser mayor a 0.',
        value: row.targetMarkup,
        severity: 'error',
        blocking: true,
      });
    }

    const roundingStep = parseOptionalNumber(row.roundingStep);
    if (roundingStep !== undefined && (!Number.isInteger(roundingStep) || roundingStep <= 0)) {
      issues.push({
        row: rowNumber,
        field: 'roundingStep',
        code: 'INVALID_ROUNDING_STEP',
        message: 'roundingStep debe ser un entero mayor a 0.',
        value: row.roundingStep,
        severity: 'error',
        blocking: true,
      });
    }

    const costMethodValue = parseOptionalText(row.costMethod)?.toLowerCase() || 'avg_weighted';
    const costMethod = costMethodValue as NormalizedRow['costMethod'];
    if (!VALID_COST_METHODS.has(costMethodValue)) {
      issues.push({
        row: rowNumber,
        field: 'costMethod',
        code: 'INVALID_COST_METHOD',
        message: 'costMethod inválido. Valores permitidos: avg_weighted, last_cost.',
        value: row.costMethod,
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
      isFractional: parseBoolean(row.isFractional, false),
      cost,
      price,
      taxRate,
      marginPercent,
      minStock,
      initialStock,
      pricingMode: VALID_PRICING_MODES.has(pricingModeValue) ? pricingMode : 'margin',
      targetMargin,
      targetMarkup,
      priceLocked: parseBoolean(row.priceLocked, false),
      roundingStep: roundingStep ?? 10,
      costMethod: VALID_COST_METHODS.has(costMethodValue) ? costMethod : 'avg_weighted',
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
