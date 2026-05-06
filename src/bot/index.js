const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { renderPdfPages } = require('./pdf/pdfRenderer');
const { preprocessImage } = require('./ocr/imagePreprocess');
const { recognizeImage } = require('./ocr/ocrService');
const { extractStructuredData } = require('./extractors');
const { createBaseRecord } = require('./extractors/baseRecord');
const { buildWorkbook } = require('./excel/excelBuilder');
const { buildAuditRow } = require('./audit/auditService');
const { getFileKind } = require('./utils/fileType');
const { normalizeWhitespace } = require('./utils/text');

function safeProgress(progress, payload) {
  if (typeof progress === 'function') progress({ ts: new Date().toISOString(), ...payload });
}

function assertNotCancelled(options) {
  if (options && typeof options.isCancelled === 'function' && options.isCancelled()) {
    const error = new Error('Processamento cancelado pelo usuario.');
    error.cancelled = true;
    throw error;
  }
}

function errorRecord(filePath, pageNumber, text, error) {
  const record = createBaseRecord(filePath, pageNumber, text || '');
  record.status_extracao = 'erro';
  record.observacoes = error && error.message ? error.message : String(error || 'Erro desconhecido');
  return record;
}

async function processImagePage({ filePath, imagePath, pageNumber, totalPages, tempDir, progress, options }) {
  assertNotCancelled(options);
  safeProgress(progress, { message: `Executando OCR na pagina ${pageNumber}/${totalPages}.`, level: 'info' });
  const preparedImage = await preprocessImage(imagePath, tempDir, pageNumber);
  const text = await recognizeImage(preparedImage, progress);
  assertNotCancelled(options);
  safeProgress(progress, { message: `Extraindo campos da pagina ${pageNumber}/${totalPages}.`, level: 'info' });
  const record = extractStructuredData(text, filePath, pageNumber, options && options.tipo);
  if (!normalizeWhitespace(text)) {
    record.status_extracao = 'erro';
    record.observacoes = record.observacoes ? `${record.observacoes}; OCR nao retornou texto` : 'OCR nao retornou texto';
  }
  safeProgress(progress, { message: `Pagina ${pageNumber}/${totalPages} processada.`, level: record.status_extracao === 'success' ? 'success' : 'warn' });
  return record;
}

async function readXlsxAsText(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const chunks = [];
  workbook.eachSheet((sheet) => {
    chunks.push(`[Aba: ${sheet.name}]`);
    sheet.eachRow((row) => {
      chunks.push(row.values.filter(Boolean).join(' | '));
    });
  });
  return chunks.join('\n');
}

async function processTextLikeFile(filePath, progress, readText, options) {
  const startedAt = new Date();
  const fileName = path.basename(filePath);
  safeProgress(progress, { message: `Lendo conteudo textual de ${fileName}.`, level: 'info' });
  const text = await readText();
  const record = extractStructuredData(text, fileName, 1, options && options.tipo);
  const rows = [record];
  const finishedAt = new Date();
  return {
    rows,
    ocrRows: [{ origem_arquivo: fileName, pagina: 1, texto_completo_ocr: text }],
    auditRow: buildAuditRow({ fileName, totalPages: 1, rows, startedAt, finishedAt }),
  };
}

async function processFile(filePath, progress, options) {
  assertNotCancelled(options);
  const kind = getFileKind(filePath);
  const fileName = path.basename(filePath);
  const startedAt = new Date();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bot-planilha-'));
  const rows = [];
  const ocrRows = [];
  let totalPages = 1;
  const tipoProcessamento = options && options.tipo;

  safeProgress(progress, { message: `Arquivo recebido: ${fileName}.`, level: 'info' });
  safeProgress(progress, { message: `Identificando tipo de arquivo: ${kind}.`, level: 'info' });

  try {
    if (kind === 'text') {
      return processTextLikeFile(filePath, progress, () => fs.readFile(filePath, 'utf8'), options);
    }

    if (kind === 'xlsx') {
      return processTextLikeFile(filePath, progress, () => readXlsxAsText(filePath), options);
    }

    if (kind === 'image') {
      totalPages = 1;
      const record = await processImagePage({ filePath, imagePath: filePath, pageNumber: 1, totalPages, tempDir, progress, options });
      rows.push(record);
      ocrRows.push({ origem_arquivo: fileName, pagina: 1, texto_completo_ocr: record.texto_completo_ocr });
    } else if (kind === 'pdf') {
      const rendered = await renderPdfPages(filePath, tempDir, progress);
      totalPages = rendered.totalPages;

      for (const page of rendered.pages) {
        assertNotCancelled(options);
        try {
          const record = await processImagePage({
            filePath,
            imagePath: page.imagePath,
            pageNumber: page.pageNumber,
            totalPages,
            tempDir,
            progress,
            options,
          });
          rows.push(record);
          ocrRows.push({ origem_arquivo: fileName, pagina: page.pageNumber, texto_completo_ocr: record.texto_completo_ocr });
        } catch (error) {
          if (error && error.cancelled) throw error;
          const record = errorRecord(filePath, page.pageNumber, '', error);
          rows.push(record);
          ocrRows.push({ origem_arquivo: fileName, pagina: page.pageNumber, texto_completo_ocr: '' });
          safeProgress(progress, { message: `Falha na pagina ${page.pageNumber}/${totalPages}; continuando.`, level: 'error' });
        }
      }
    } else {
      const record = errorRecord(filePath, 1, '', new Error('Tipo de arquivo nao suportado'));
      rows.push(record);
      ocrRows.push({ origem_arquivo: fileName, pagina: 1, texto_completo_ocr: '' });
    }
  } catch (error) {
    if (error && error.cancelled) throw error;
    const record = errorRecord(filePath, rows.length + 1, '', error);
    if (!rows.length) {
      rows.push(record);
      ocrRows.push({ origem_arquivo: fileName, pagina: record.pagina, texto_completo_ocr: '' });
    }
    safeProgress(progress, { message: `Falha ao processar ${fileName}; erro registrado na planilha.`, level: 'error' });
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  const finishedAt = new Date();
  safeProgress(progress, { message: `Validando paginas de ${fileName}.`, level: 'info' });
  const auditRow = buildAuditRow({ fileName, totalPages, rows, startedAt, finishedAt });
  if (auditRow.status_final !== 'ok') {
    const avisos = [];
    if (auditRow.paginas_com_erro) avisos.push(`paginas com erro/parcial: ${auditRow.paginas_com_erro}`);
    if (auditRow.paginas_sem_dados) avisos.push(`paginas sem dados: ${auditRow.paginas_sem_dados}`);
    safeProgress(progress, { message: `Encontrei avisos em ${fileName}: ${avisos.join('; ') || 'campos em branco'}.`, level: 'warn' });
  }
  return {
    rows,
    ocrRows,
    auditRow,
  };
}

async function processFiles(filePaths, progress, options = {}) {
  if (!Array.isArray(filePaths) || !filePaths.length) throw new Error('Nenhum arquivo selecionado.');

  const { formatos = ['xlsx'], modo = 'separado', tipo = 'etiquetas' } = options;
  const startedAt = Date.now();
  const allRows = [];
  const allAuditRows = [];
  const allOcrRows = [];
  const arquivosOutput = [];

  const infoModo = tipo === 'geral' ? ' (modo Geral)' : ' (modo etiquetas)';
  safeProgress(progress, { message: `Iniciando processamento de ${filePaths.length} arquivo(s)${infoModo}.`, level: 'info' });

  const processarPorArquivo = async (filePath, idx) => {
    assertNotCancelled(options);
    const fileName = path.basename(filePath);
    safeProgress(progress, { message: `Processando ${fileName} (${idx + 1}/${filePaths.length})...`, level: 'info' });
    const progressoArquivo = (payload) => safeProgress(progress, { fileName, ...payload });
    return processFile(filePath, progressoArquivo, options);
  };

  let resultados;
  if (modo === 'separado') {
    resultados = [];
    for (let i = 0; i < filePaths.length; i++) {
      const resultado = await processarPorArquivo(filePaths[i], i);
      resultados.push(resultado);

      safeProgress(progress, { message: `Gerando arquivo(s) para ${path.basename(filePaths[i])}...`, level: 'info' });
      const outputDir = path.join(process.cwd(), 'saida');
      const outputPaths = await buildWorkbook({ outputDir, rows: resultado.rows, formatos, tipo });
      const hasAlert = resultado.auditRow.status_final !== 'ok';
      arquivosOutput.push({
        arquivoOrigem: path.basename(filePaths[i]),
        paths: Array.isArray(outputPaths) ? outputPaths : [outputPaths],
        status: hasAlert ? 'alerta' : 'ok',
        auditRow: resultado.auditRow,
      });
    }
  } else {
    resultados = await Promise.all(filePaths.map(processarPorArquivo));

    safeProgress(progress, { message: 'Gerando planilha unica.', level: 'info' });
    resultados.forEach((result) => {
      allRows.push(...result.rows);
      allAuditRows.push(result.auditRow);
      allOcrRows.push(...result.ocrRows);
    });

    const outputDir = path.join(process.cwd(), 'saida');
    const outputPaths = await buildWorkbook({ outputDir, rows: allRows, formatos, tipo });
    const hasAlert = allAuditRows.some((row) => row.status_final !== 'ok');
    arquivosOutput.push({
      arquivoOrigem: 'todos-arquivos',
      paths: Array.isArray(outputPaths) ? outputPaths : [outputPaths],
      status: hasAlert ? 'alerta' : 'ok',
    });
  }

  const hasAlert = arquivosOutput.some((a) => a.status === 'alerta');
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

  safeProgress(progress, {
    message: hasAlert ? 'Arquivos gerados com alertas.' : 'Arquivos prontos para baixar.',
    level: hasAlert ? 'warn' : 'success',
  });

  const totalRegistros = arquivosOutput.reduce((sum, a) => sum + (a.auditRow?.total_registros_extraidos || 0), 0);
  const totalPaginas = arquivosOutput.reduce((sum, a) => sum + (a.auditRow?.total_paginas_detectadas || 0), 0);

  if (modo === 'separado') {
    const primeiroArquivo = arquivosOutput[0]?.paths?.[0];
    const primeiroPath = typeof primeiroArquivo === 'string' ? primeiroArquivo : primeiroArquivo?.path || '';
    console.log('[DEBUG] modo separado - primeiroPath:', primeiroPath);
    return {
      ok: true,
      outputPath: primeiroPath,
      fileName: arquivosOutput.length === 1 ? path.basename(primeiroPath || '') : `${arquivosOutput.length} arquivo(s) gerado(s)`,
      arquivosOutput,
      totalRegistros,
      totalPaginas,
      totalArquivos: filePaths.length,
      statusFinal: hasAlert ? 'alerta' : 'ok',
      duracaoSegundos: durationSeconds,
      modo,
      formatos,
      avisos: arquivosOutput.filter((item) => item.status !== 'ok').map((item) => item.arquivoOrigem + ': campos nao identificados'),
    };
  }

  return {
    ok: true,
    outputPath: arquivosOutput[0]?.paths?.[0]?.path || '',
    fileName: path.basename(arquivosOutput[0]?.paths?.[0]?.path || ''),
    totalRegistros: allRows.length,
    totalPaginas: allAuditRows.reduce((sum, row) => sum + Number(row.total_paginas_detectadas || 0), 0),
    totalArquivos: filePaths.length,
    statusFinal: hasAlert ? 'alerta' : 'ok',
    duracaoSegundos: durationSeconds,
    avisos: allAuditRows.filter((row) => row.status_final !== 'ok').map((row) => row.origem_arquivo + ': campos nao identificados'),
  };
}

async function processTextContent(text, progress) {
  const startedAt = Date.now();
  const fileName = 'texto-colado.txt';
  safeProgress(progress, { message: 'Texto colado recebido.', level: 'info' });
  const rows = [extractStructuredData(text || '', fileName, 1)];
  const auditRow = buildAuditRow({ fileName, totalPages: 1, rows, startedAt: new Date(startedAt), finishedAt: new Date() });
  safeProgress(progress, { message: 'Gerando planilha Excel.', level: 'info' });
  const outputDir = path.join(process.cwd(), 'saida');
  const outputPath = await buildWorkbook({
    outputDir,
    rows,
    auditRows: [auditRow],
    ocrRows: [{ origem_arquivo: fileName, pagina: 1, texto_completo_ocr: text || '' }],
  });
  const hasAlert = auditRow.status_final !== 'ok';
  safeProgress(progress, { message: hasAlert ? 'Planilha gerada com alertas de auditoria.' : 'Planilha pronta para baixar.', level: hasAlert ? 'warn' : 'success' });
  return {
    ok: true,
    outputPath,
    fileName: path.basename(outputPath),
    totalRegistros: rows.length,
    totalPaginas: 1,
    totalArquivos: 1,
    statusFinal: hasAlert ? 'alerta' : 'ok',
    duracaoSegundos: Math.round((Date.now() - startedAt) / 1000),
  };
}

module.exports = { processFiles, processTextContent };
