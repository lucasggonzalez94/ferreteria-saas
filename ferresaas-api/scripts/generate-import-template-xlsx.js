const path = require('path');
const ExcelJS = require('exceljs');

const HEADERS = [
  'nombre',
  'codigo_barras',
  'descripcion',
  'categoria',
  'marca',
  'unidad',
  'precio_costo',
  'precio_venta',
  'IVA',
  'stock_minimo',
  'stock_inicial',
  'es_fraccionable',
  'modo_precio',
  'margen',
  'markup',
  'precio_fijo',
  'paso_redondeo',
  'metodo_costo',
];

const REQUIRED_COLUMNS = new Set([
  'nombre',
  'categoria',
  'marca',
  'unidad',
  'precio_costo',
  'precio_venta',
  'IVA',
]);

const SAMPLE_ROWS = [
  ['Taladro Inalambrico 18V', '7791234567890', 'Taladro percutor con bateria', 'Herramientas Electricas', 'Bosch', 'u', 85000, 119900, 21, 2, 4, 'false', 'margin', 35, '', 'false', 10, 'avg_weighted'],
  ['Disco de corte 4.5', '', 'Disco para amoladora', 'Accesorios', 'Stanley', 'u', 2800, 4200, 21, 10, 20, 'false', 'fixed', '', '', 'false', 10, 'avg_weighted'],
  ['Cables electricos 2.5mm', '7412589630147', 'Cable unipolar 100m', 'Electricidad', 'Philips', 'u', 45000, 65000, 21, 5, 10, 'false', 'margin', 30, '', 'false', 10, 'avg_weighted'],
  ['Tornillos hexagonal 8mm', '', 'Pack x100 unidades', 'Ferreteria General', 'Bosch', 'u', 12000, 18500, 21, 15, 50, 'true', 'fixed', '', '', 'false', 5, 'avg_weighted'],
  ['Pintura latex blanca 20L', '8529637410258', 'Pintura acrilica para interiores', 'Pinturas', 'Alba', 'u', 85000, 129000, 21, 2, 3, 'false', 'margin', 35, '', 'false', 100, 'avg_weighted'],
  ['Cemento portland 50kg', '9638527410369', 'Cemento Holcim tipo I', 'Materiales de Construccion', 'Holcim', 'kg', 2800, 4200, 21, 10, 50, 'false', 'suggest', '', '', 'false', 10, 'avg_weighted'],
];

const COLUMN_WIDTHS = [26, 16, 34, 24, 16, 10, 14, 14, 10, 12, 12, 16, 14, 10, 10, 12, 14, 16];

function applyHeaderStyle(cell) {
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF0E2238' } },
    left: { style: 'thin', color: { argb: 'FF0E2238' } },
    bottom: { style: 'thin', color: { argb: 'FF0E2238' } },
    right: { style: 'thin', color: { argb: 'FF0E2238' } },
  };
}

function applyDataStyle(cell, isRequired) {
  cell.font = { name: 'Calibri', size: 10 };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: isRequired ? 'FFFFF8E7' : 'FFFFFFFF' },
  };
  cell.alignment = { vertical: 'middle' };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  };
}

function setColumnFormats(ws) {
  ws.getColumn(7).numFmt = '$ #,##0';
  ws.getColumn(8).numFmt = '$ #,##0';
  ws.getColumn(9).numFmt = '0"%"';
  ws.getColumn(10).numFmt = '#,##0';
  ws.getColumn(11).numFmt = '#,##0';
  ws.getColumn(14).numFmt = '0"%"';
  ws.getColumn(15).numFmt = '#,##0.00';
  ws.getColumn(17).numFmt = '#,##0';
}

function setDataValidations(ws) {
  for (let row = 2; row <= 1000; row++) {
    ws.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"u,mt,kg,lt"'],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Unidad invalida',
      error: 'Usa uno de estos valores: u, mt, kg o lt.',
    };

    ws.getCell(`M${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"fixed,margin,markup,suggest"'],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Modo de precio invalido',
      error: 'Usa uno de estos valores: fixed, margin, markup o suggest.',
    };

    ws.getCell(`R${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"avg_weighted,last_cost"'],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Metodo de costo invalido',
      error: 'Usa uno de estos valores: avg_weighted o last_cost.',
    };

    ws.getCell(`L${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"true,false"'],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Valor invalido',
      error: 'Usa true o false.',
    };

    ws.getCell(`P${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"true,false"'],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Valor invalido',
      error: 'Usa true o false.',
    };
  }
}

function addInstructionsSheet(workbook) {
  const ws = workbook.addWorksheet('Instrucciones', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { width: 34 },
    { width: 88 },
  ];

  ws.mergeCells('A1:B1');
  const title = ws.getCell('A1');
  title.value = 'Guia de uso - Importacion de catalogo';
  title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'left', vertical: 'middle' };
  title.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };

  ws.addRow(['Paso', 'Detalle']);
  ws.getRow(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F5D8A' },
  };

  const rows = [
    ['1. Completa la hoja Productos', 'Carga una fila por producto usando exactamente las columnas de la plantilla.'],
    ['2. Respeta campos obligatorios', 'Obligatorios: nombre, categoria, marca, unidad, precio_costo, precio_venta, IVA.'],
    ['3. Usa valores validos', 'unidad: u|mt|kg|lt, modo_precio: fixed|margin|markup|suggest, metodo_costo: avg_weighted|last_cost, booleanos: true|false.'],
    ['4. Revisa formatos numericos', 'precio_costo/precio_venta en importe, IVA y margen en porcentaje, stock y paso_redondeo en enteros.'],
    ['5. Evita duplicados', 'Si hay codigo_barras se usa ese valor; si no, se valida por nombre + marca.'],
    ['6. Importa desde el sistema', 'En Productos > Importar, sube el XLSX y revisa el preview antes de ejecutar.'],
  ];

  for (const row of rows) {
    ws.addRow(row);
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    row.height = 28;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowNumber % 2 === 0 ? 'FFF7FAFF' : 'FFFFFFFF' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
  });
}

async function generateTemplate(outputPath) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Productos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.addRow(HEADERS);
  for (const row of SAMPLE_ROWS) {
    ws.addRow(row);
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };

  HEADERS.forEach((header, index) => {
    ws.getColumn(index + 1).width = COLUMN_WIDTHS[index];
    const headerCell = ws.getCell(1, index + 1);
    applyHeaderStyle(headerCell);

    for (let row = 2; row <= 1000; row++) {
      applyDataStyle(ws.getCell(row, index + 1), REQUIRED_COLUMNS.has(header));
    }
  });

  setColumnFormats(ws);
  setDataValidations(ws);
  addInstructionsSheet(workbook);

  await workbook.xlsx.writeFile(outputPath);
}

async function main() {
  const root = path.resolve(__dirname, '..', '..');
  const rootTemplate = path.join(root, 'plantilla-importacion-catalogo.xlsx');
  const publicTemplate = path.join(root, 'ferresaas-web', 'public', 'templates', 'plantilla-importacion-catalogo.xlsx');

  await generateTemplate(rootTemplate);
  await generateTemplate(publicTemplate);

  console.log('Plantilla XLSX actualizada en:');
  console.log(`- ${rootTemplate}`);
  console.log(`- ${publicTemplate}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
