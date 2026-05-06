function buildAuditRow({ fileName, totalPages, rows, startedAt, finishedAt }) {
  const pagesWithError = rows.filter((row) => row.status_extracao === 'erro').map((row) => row.pagina);
  const pagesPartial = rows.filter((row) => row.status_extracao === 'parcial').map((row) => row.pagina);
  const pagesWithoutData = rows.filter((row) => row.status_extracao === 'erro' && !row.texto_completo_ocr).map((row) => row.pagina);
  const processedPages = new Set(rows.map((row) => row.pagina)).size;
  const totalRecords = rows.length;
  const durationSeconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
  const hasDivergence = totalPages !== processedPages || totalPages !== totalRecords;
  const status = pagesWithError.length || pagesPartial.length || hasDivergence ? 'alerta' : 'ok';

  return {
    origem_arquivo: fileName,
    total_paginas_detectadas: totalPages,
    total_paginas_processadas: processedPages,
    total_registros_extraidos: totalRecords,
    paginas_com_erro: pagesWithError.concat(pagesPartial.map((page) => `${page} (parcial)`)).join(', '),
    paginas_sem_dados: pagesWithoutData.join(', '),
    data_processamento: finishedAt.toLocaleString('pt-BR'),
    duracao_processamento: `${durationSeconds}s`,
    status_final: status,
  };
}

module.exports = { buildAuditRow };
