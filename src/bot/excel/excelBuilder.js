const fs = require('fs/promises');
const path = require('path');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
const { TEMPLATE_COLUMNS } = require('../constants');
const { normalizeCep } = require('../utils/text');

const FORMATOS_DISPONIVEIS = ['xlsx', 'csv', 'txt', 'pdf', 'png', 'jpg', 'jpeg', 'zpl', 'epl', 'tspl', 'prn', 'lbl'];

function getAllKeys(rows) {
  const keys = new Set();
  rows.forEach(row => {
    Object.keys(row).forEach(key => keys.add(key));
  });
  return Array.from(keys).filter(k => k !== 'texto_completo_ocr');
}

function gerarCsv(rows, columns) {
  const header = columns.map(c => c.header).join(';');
  const lines = rows.map(row => {
    return columns.map(col => {
      const val = row[col.key];
      if (val === null || val === undefined || val === '') return '';
      return String(val).replace(/"/g, '""').replace(/;/g, ',');
    }).join(';');
  });
  return [header, ...lines].join('\n');
}

function gerarTxt(rows, columns) {
  const header = columns.map(col => col.header).join(' | ');
  const lines = rows.map(row => {
    return columns.map(col => {
      const val = row[col.key];
      if (val === null || val === undefined || val === '') return '';
      return String(val);
    }).join(' | ');
  });
  return [header, ...lines].join('\n');
}

function escaparXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gerarSvgTabela(rows, columns) {
  const cellWidth = 150;
  const rowHeight = 34;
  const width = columns.length * cellWidth + 40;
  const height = Math.max(120, (rows.length + 1) * rowHeight + 60);
  const header = columns.map((col, i) => {
    const x = 20 + i * cellWidth;
    return `<rect x="${x}" y="20" width="${cellWidth}" height="${rowHeight}" fill="#111827"/><text x="${x + 8}" y="42" font-size="13" font-family="Arial" font-weight="700" fill="#ffffff">${escaparXml(col.header)}</text>`;
  }).join('');
  const body = rows.map((row, rowIndex) => {
    return columns.map((col, colIndex) => {
      const x = 20 + colIndex * cellWidth;
      const y = 20 + (rowIndex + 1) * rowHeight;
      const value = escaparXml(String(row[col.key] || '').slice(0, 22));
      return `<rect x="${x}" y="${y}" width="${cellWidth}" height="${rowHeight}" fill="${rowIndex % 2 ? '#f9fafb' : '#ffffff'}" stroke="#e5e7eb"/><text x="${x + 8}" y="${y + 22}" font-size="12" font-family="Arial" fill="#111827">${value}</text>`;
    }).join('');
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/><text x="20" y="14" font-size="12" font-family="Arial" fill="#6b7280">Metrys Planilhas</text>${header}${body}</svg>`;
}

function escaparPdf(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function gerarPdfSimples(rows, columns) {
  const lines = ['Metrys Planilhas', '', columns.map(c => c.header).join(' | ')];
  rows.forEach(row => {
    lines.push(columns.map(col => String(row[col.key] || '')).join(' | '));
  });

  const contentLines = lines.slice(0, 45).map((line, index) => {
    const y = 780 - index * 16;
    return `BT /F1 9 Tf 40 ${y} Td (${escaparPdf(line).slice(0, 115)}) Tj ET`;
  }).join('\n');
  const stream = contentLines;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach(obj => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj + '\n';
  });
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function gerarComandosEtiqueta(rows, tipo) {
  return rows.map(row => {
    const plataforma = String(row.PLATAFORMA || '');
    const id = String(row['ID DA VENDA'] || '');
    const cep = String(row.CEP || '');
    const regiao = String(row['REGIÃO'] || '');

    if (tipo === 'zpl') {
      return `^XA\n^CF0,28\n^FO30,30^FD${plataforma}^FS\n^FO30,70^FDID: ${id}^FS\n^FO30,110^FDCEP: ${cep}^FS\n^FO30,150^FD${regiao}^FS\n^XZ`;
    }
    if (tipo === 'epl') {
      return `N\nA30,30,0,3,1,1,N,"${plataforma}"\nA30,70,0,3,1,1,N,"ID: ${id}"\nA30,110,0,3,1,1,N,"CEP: ${cep}"\nA30,150,0,3,1,1,N,"${regiao}"\nP1`;
    }
    if (tipo === 'tspl') {
      return `SIZE 100 mm,50 mm\nCLS\nTEXT 30,30,"3",0,1,1,"${plataforma}"\nTEXT 30,70,"3",0,1,1,"ID: ${id}"\nTEXT 30,110,"3",0,1,1,"CEP: ${cep}"\nTEXT 30,150,"3",0,1,1,"${regiao}"\nPRINT 1`;
    }
    return `${plataforma}\nID: ${id}\nCEP: ${cep}\n${regiao}`;
  }).join('\n\n');
}

const REGION_ACCENTS = new Map([
  ['CARAPICUIBA', 'Carapicuíba'],
  ['SAO PAULO', 'São Paulo'],
  ['EMBU DAS ARTES', 'Embu das Artes'],
  ['GUARULHOS', 'Guarulhos'],
  ['SANTO ANDRE', 'Santo André'],
  ['SAO BERNARDO DO CAMPO', 'São Bernardo do Campo'],
  ['SAO CAETANO DO SUL', 'São Caetano do Sul'],
  ['TABOAO DA SERRA', 'Taboão da Serra'],
  ['MOGI DAS CRUZES', 'Mogi das Cruzes'],
  ['FERRAZ DE VASCONCELOS', 'Ferraz de Vasconcelos'],
  ['MAUA', 'Mauá'],
  ['SUZANO', 'Suzano'],
  ['FRANCO DA ROCHA', 'Franco da Rocha'],
  ['CAIEIRAS', 'Caieiras'],
  ['COTIA', 'Cotia'],
  ['BARUERI', 'Barueri'],
  ['ITAPEVI', 'Itapevi'],
]);

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toTitleCase(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const upper = stripAccents(raw).toUpperCase();
  if (REGION_ACCENTS.has(upper)) return REGION_ACCENTS.get(upper);
  return raw.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function isMercadoLivre(row) {
  const src = `${row.marketplace || ''} ${row.tipo_documento || ''} ${row.remetente_nome || ''} ${row.texto_completo_ocr || ''}`.toLowerCase();
  return src.includes('mercado') || src.includes('envio flex') || src.includes('goose') || /\b2\d{15}\b/.test(src);
}

function isShopee(row) {
  const src = `${row.marketplace || ''} ${row.tipo_documento || ''} ${row.texto_completo_ocr || ''}`.toLowerCase();
  return src.includes('shopee') || src.includes('xhopee') || src.includes('danfe') || src.includes('entrega direta');
}

function mapPlatform(row) {
  if (!isShopee(row) && !isMercadoLivre(row)) return '';
  const src = `${row.marketplace || ''} ${row.texto_completo_ocr || ''}`.toLowerCase();
  if (isShopee(row)) {
    const nfDigits = String(row.nf || '').replace(/\D/g, '');
    if (nfDigits && nfDigits.length <= 5) return 'Xhopee';
    return src.includes('xhopee') ? 'Xhopee' : 'Shopee';
  }
  return 'GooseGuardian';
}

function mapTipo(row, platform) {
  const value = `${row.tipo_endereco || ''} ${row.tipo_local || ''}`.toLowerCase();
  if (platform === 'GooseGuardian') return value.includes('comercial') ? 'Comercial' : 'Trabalho';
  if (value.includes('casa')) return 'Casa';
  if (value.includes('trabalho')) return 'Trabalho';
  if (value.includes('comercial')) return 'Trabalho';
  return '';
}

function mapRegion(row, platform) {
  let region = platform === 'GooseGuardian'
    ? row.rota || row.cidade || row.sub_regiao || row.bairro_rota || ''
    : row.cidade || row.rota || row.sub_regiao || row.bairro_rota || '';

  if (!region && platform === 'GooseGuardian') {
    const lines = String(row.texto_completo_ocr || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const cepIndex = lines.findIndex((line) => /CEP\s*:/i.test(line));
    if (cepIndex >= 0) {
      region = lines.slice(cepIndex + 1).find((line) => /^[A-ZÁÉÍÓÚÃÕÇ0-9 ]{3,}$/.test(line) && !/^\d{8}$/.test(line.replace(/\D/g, ''))) || '';
    }
  }
  return toTitleCase(region);
}

function extractCep(row) {
  const direct = normalizeCep(row.cep || row.cep_numerico || '');
  if (direct) return direct;
  const match = String(row.texto_completo_ocr || '').match(/CEP\s*:?\s*([0-9 .-]{8,12})/i);
  return normalizeCep(match ? match[1] : '');
}

function formatData(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const textual = raw.match(/(\d{1,2})\s*(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)/i);
  if (textual) return `${textual[1].padStart(2, '0')}/${monthNames[['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'].indexOf(textual[2].toUpperCase())]}`;
  const numeric = raw.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-]\d{2,4})?/);
  if (numeric) return `${numeric[1].padStart(2, '0')}/${monthNames[Number(numeric[2]) - 1] || numeric[2].padStart(2, '0')}`;
  return raw;
}

function mapData(row, platform) {
  if (platform === 'GooseGuardian') return formatData(row.data_envio || row.datas_encontradas || '');
  return formatData(row.data_entrega || row.emissao || row.datas_encontradas || '');
}

function mapTemplateRow(row) {
  const platform = mapPlatform(row);
  const rawId = platform === 'Shopee' || platform === 'Xhopee' ? row.pedido : row.venda_id || row.pack_id || '';
  const id = platform === 'GooseGuardian' && rawId ? `#${String(rawId).replace(/^#/, '')}` : String(rawId || '');
  const cep = extractCep(row);

  return {
    PLATAFORMA: platform,
    'ID DA VENDA': id,
    DATA: mapData(row, platform),
    'REGIÃO': mapRegion(row, platform),
    TAMANHO: 'P',
    TIPO: mapTipo(row, platform),
    NF: platform === 'Shopee' || platform === 'Xhopee' ? String(row.nf || '') : '',
    CEP: cep,
    FRETE: 1,
  };
}

function addTemplateSheet(workbook, rows) {
  const sheet = workbook.addWorksheet('Etiquetas');
  sheet.columns = TEMPLATE_COLUMNS.map((key) => ({ header: key, key, width: key.length + 4, style: { numFmt: '@' } }));
  rows.map(mapTemplateRow).forEach((row) => sheet.addRow(row));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TEMPLATE_COLUMNS.length } };

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    ['B', 'C', 'G', 'H'].forEach((letter) => {
      sheet.getCell(`${letter}${rowNumber}`).numFmt = '@';
      sheet.getCell(`${letter}${rowNumber}`).value = String(sheet.getCell(`${letter}${rowNumber}`).value || '');
    });
  }

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  sheet.columns.forEach((column) => {
    let maxLength = String(column.header || '').length;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value || '').length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 28);
  });

  return sheet;
}

function buildGeralSheet(workbook, rows) {
  const columns = getAllKeys(rows);
  const sheet = workbook.addWorksheet('Dados Gerais');
  sheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(key.length + 3, 18) }));
  rows.forEach((row) => sheet.addRow(row));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  sheet.columns.forEach((column) => {
    let maxLength = String(column.header || '').length;
    column.eachCell({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value || '').length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 28);
  });

  return sheet;
}

function validateMainSheet(sheet) {
  if (!sheet || sheet.name !== 'Etiquetas') throw new Error('A aba principal deve se chamar Etiquetas.');
  if (sheet.columnCount !== 9) throw new Error('A aba Etiquetas deve ter exatamente 9 colunas.');

  const headers = sheet.getRow(1).values.slice(1, 10);
  const invalidHeader = TEMPLATE_COLUMNS.some((header, index) => headers[index] !== header);
  if (invalidHeader) throw new Error('Cabecalho da aba Etiquetas fora do modelo obrigatorio.');

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const platform = String(row.getCell(1).value || '');
    const id = String(row.getCell(2).value || '');
    const tamanho = String(row.getCell(5).value || '');
    const nf = String(row.getCell(7).value || '');
    const cep = String(row.getCell(8).value || '');
    const frete = String(row.getCell(9).value || '');

    if (platform === 'GooseGuardian' && nf) row.getCell(7).value = '';
    if ((platform === 'Shopee' || platform === 'Xhopee') && id.startsWith('#')) row.getCell(2).value = id.replace(/^#+/, '');
    if (cep && !/^\d{5}-\d{3}$/.test(cep)) row.getCell(8).value = normalizeCep(cep);
    if (tamanho !== 'P') row.getCell(5).value = 'P';
    if (frete !== '1') row.getCell(9).value = '1';
  }
}

async function buildWorkbook({ outputDir, rows, formatos = ['xlsx'], tipo = 'etiquetas' }) {
  await fs.mkdir(outputDir, { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bot PDF para Planilha';
  workbook.created = new Date();

  let sheet;
  if (tipo === 'geral') {
    workbook.removeWorksheet('Sheet');
    sheet = buildGeralSheet(workbook, rows);
  } else {
    sheet = addTemplateSheet(workbook, rows);
    validateMainSheet(sheet);
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').slice(0, 15);
  const outputPaths = [];
  const columns = sheet.columns.map(c => ({ key: c.key, header: c.header }));
  const templateRows = tipo === 'geral' ? rows : rows.map(mapTemplateRow);

  if (formatos.includes('xlsx')) {
    const xlsxPath = path.join(outputDir, `planilha-etiquetas-${stamp}.xlsx`);
    await workbook.xlsx.writeFile(xlsxPath);
    outputPaths.push({ formato: 'xlsx', path: xlsxPath });
  }

  if (formatos.includes('csv')) {
    const csvData = gerarCsv(templateRows, columns);
    const csvPath = path.join(outputDir, `planilha-etiquetas-${stamp}.csv`);
    await fs.writeFile(csvPath, csvData, 'utf8');
    outputPaths.push({ formato: 'csv', path: csvPath });
  }

  if (formatos.includes('txt')) {
    const txtData = gerarTxt(templateRows, columns);
    const txtPath = path.join(outputDir, `planilha-etiquetas-${stamp}.txt`);
    await fs.writeFile(txtPath, txtData, 'utf8');
    outputPaths.push({ formato: 'txt', path: txtPath });
  }

  if (formatos.includes('pdf')) {
    const pdfPath = path.join(outputDir, `planilha-etiquetas-${stamp}.pdf`);
    await fs.writeFile(pdfPath, gerarPdfSimples(templateRows, columns));
    outputPaths.push({ formato: 'pdf', path: pdfPath });
  }

  if (formatos.includes('png') || formatos.includes('jpg') || formatos.includes('jpeg')) {
    const svg = gerarSvgTabela(templateRows, columns);
    if (formatos.includes('png')) {
      const pngPath = path.join(outputDir, `planilha-etiquetas-${stamp}.png`);
      await sharp(Buffer.from(svg)).png().toFile(pngPath);
      outputPaths.push({ formato: 'png', path: pngPath });
    }
    if (formatos.includes('jpg')) {
      const jpgPath = path.join(outputDir, `planilha-etiquetas-${stamp}.jpg`);
      await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(jpgPath);
      outputPaths.push({ formato: 'jpg', path: jpgPath });
    }
    if (formatos.includes('jpeg')) {
      const jpegPath = path.join(outputDir, `planilha-etiquetas-${stamp}.jpeg`);
      await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(jpegPath);
      outputPaths.push({ formato: 'jpeg', path: jpegPath });
    }
  }

  ['zpl', 'epl', 'tspl', 'prn', 'lbl'].forEach((formato) => {
    if (!formatos.includes(formato)) return;
    const arquivoPath = path.join(outputDir, `planilha-etiquetas-${stamp}.${formato}`);
    outputPaths.push({ formato, path: arquivoPath, conteudo: gerarComandosEtiqueta(templateRows, formato) });
  });

  for (const item of outputPaths.filter(item => item.conteudo !== undefined)) {
    await fs.writeFile(item.path, item.conteudo, 'utf8');
    delete item.conteudo;
  }

  return outputPaths.length === 1 ? outputPaths[0].path : outputPaths;
}

module.exports = { buildWorkbook, FORMATOS_DISPONIVEIS };
