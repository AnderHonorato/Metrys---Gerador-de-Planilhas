const { createBaseRecord, finalizeRecord } = require('./baseRecord');
const {
  collectCodes,
  collectDates,
  lines,
  matchFirst,
  normalizeCep,
  normalizeCepNumber,
  normalizeDate,
  normalizeName,
  normalizeUpperWord,
  normalizeWhitespace,
  sectionBetween,
} = require('../utils/text');

function normalizarLinhaNumerica(value) {
  return String(value || '')
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/\D/g, '');
}

function limparPedido(value) {
  return normalizeUpperWord(value).replace(/[^A-Z0-9]/g, '');
}

function primeiraLinhaCidade(lista, inicio) {
  const proibidos = /^(CASA|TRABALHO|COMERCIAL|REMETENTE|DESTINAT[ÁA]RIO|ENTREGA\s+DIRETA|CEP|PEDIDO|NF|S[ÉE]RIE)$/i;
  return normalizeName((lista || []).slice(inicio).find((line) => {
    const clean = normalizeWhitespace(line);
    if (!clean || proibidos.test(clean)) return false;
    if (/^[A-Z]{2}\d{8,}/i.test(clean)) return false;
    if (/^[0-9\- ]+$/.test(clean)) return false;
    return /[A-ZÁÉÍÓÚÃÕÇ]/i.test(clean);
  }) || '');
}

function extractShopee(text, filePath, pageNumber) {
  const record = createBaseRecord(filePath, pageNumber, text);
  const src = normalizeWhitespace(text);
  const list = lines(src);

  record.marketplace = /\bXhopee\b/i.test(src) ? 'Xhopee' : 'Shopee';
  record.tipo_documento = /DANFE/i.test(src) ? 'DANFE simplificado / etiqueta' : 'Entrega Direta';
  record.nf = matchFirst(src, [/N\s*F\s*[º°oO:]?\s*(\d{3,9})/i, /N[Ff]\s*[:\s]\s*(\d{3,9})/i, /DANFE[\s\S]{0,80}?\b(\d{3,9})\b/i]);
  if (record.nf && String(record.nf).replace(/\D/g, '').length <= 5) record.marketplace = 'Xhopee';
  record.serie = matchFirst(src, [/S[éee]rie\s*[:\s]\s*(\d+)/i, /S[éee]r[ií1]e\s*[:\s]\s*(\d+)/i]);
  record.emissao = normalizeDate(matchFirst(src, [/Emiss[aãao0]\s*[:\s]\s*([^\n]+)/i, /Em[i1]ss[aãao0][\s\S]{0,20}?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i]));
  record.data_entrega = normalizeDate(matchFirst(src, [/Data\s*d[ae]\s*entrega\s*[:;]?\s*([0-9/.-]+)/i, /entrega\s*[:;]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i, /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/i]));
  record.pedido = limparPedido(matchFirst(src, [/Ped[i1l]do\s*[:;]?\s*([A-Z0-9]{8,})/i, /Pedido\s*[:;]?\s*([A-Z0-9]{8,})/i, /\b(\d{6}[A-Z0-9]{8,})\b/i]));
  record.cep_numerico = normalizeCepNumber(matchFirst(src, [/CEP\s*[:;]?\s*([0-9 .-]{8,12})/i, /\b([0-9]{5}[- ]?[0-9]{3})\b/i]));
  record.cep = normalizeCep(record.cep_numerico);
  record.bairro = normalizeName(matchFirst(src, [/Bairro\s*:\s*(.+?)\s+CEP\s*:/i, /Bairro\s*:\s*([^\n]+)/i]));
  record.codigo_qr = normalizeUpperWord(matchFirst(src, [/\b(BR[A-Z0-9]{8,})\b/i]));
  record.codigos = collectCodes(src);
  record.datas_encontradas = collectDates(src);

  const destinatarioSection = sectionBetween(src, /DESTINAT[ÁA]RIO/i, /ENTREGA\s+DIRETA/i);
  const destLines = lines(destinatarioSection).filter((line) => !/^Bairro|^CEP|^Pedido/i.test(line));
  record.destinatario_nome = normalizeName(destLines[0] || '');
  record.endereco = destLines.slice(1).join(' ');

  const routeNumberIndex = list.findIndex((line) => /^\d{3}$/.test(normalizarLinhaNumerica(line.trim())));
  if (routeNumberIndex >= 0) {
    record.rota_numero = normalizarLinhaNumerica(list[routeNumberIndex]).slice(0, 3);
    record.rota = record.rota_numero;
    record.cep_rota = normalizeCep(matchFirst(list.slice(routeNumberIndex + 1, routeNumberIndex + 4).join('\n'), [/([0-9]{5}[- ]?[0-9]{3})/]));
    const afterRoute = list.slice(routeNumberIndex + 1).filter((line) => !/^[0-9]{5}[- ]?[0-9]{3}$/.test(line));
    record.cidade = primeiraLinhaCidade(afterRoute, 0);
    const cidadeIndex = afterRoute.findIndex((line) => normalizeName(line) === record.cidade);
    record.sub_regiao = primeiraLinhaCidade(afterRoute, cidadeIndex >= 0 ? cidadeIndex + 1 : 1);
    record.tipo_local = normalizeUpperWord(matchFirst(afterRoute.join('\n'), [/\b(CASA|TRABALHO|COMERCIAL)\b/i]));
    record.tipo_endereco = record.tipo_local;
  }

  if (!record.cidade && record.cep) {
    const cepIndex = list.findIndex((line) => normalizeCepNumber(line) === record.cep_numerico || line.includes(record.cep));
    if (cepIndex >= 0) record.cidade = primeiraLinhaCidade(list, cepIndex + 1);
  }

  if (!record.tipo_endereco) {
    record.tipo_endereco = normalizeUpperWord(list.find((line) => /^(CASA|TRABALHO|COMERCIAL)$/i.test(line)) || '');
  }

  const remetenteSection = sectionBetween(src, /REMETENTE/i, /$/);
  const remetenteLines = lines(remetenteSection);
  record.remetente_nome = normalizeName(remetenteLines[0] || '');
  record.remetente_cep = normalizeCep(matchFirst(remetenteSection, [/CEP\s*:\s*([0-9 .-]{8,12})/i]));
  record.remetente_endereco = remetenteLines.slice(1).filter((line) => !/^CEP/i.test(line)).join(' | ');

  return finalizeRecord(record, ['cep', 'destinatario_nome', 'pedido', 'nf', 'data_entrega']);
}

module.exports = { extractShopee };
