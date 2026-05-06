const { createBaseRecord, finalizeRecord } = require('./baseRecord');
const {
  collectCodes,
  collectDates,
  matchFirst,
  normalizeCep,
  normalizeCepNumber,
  normalizeName,
  normalizeWhitespace,
  onlyDigits,
  splitNameAndUser,
} = require('../utils/text');

function extractGenericText(text, filePath, pageNumber) {
  const record = createBaseRecord(filePath, pageNumber, text);
  const src = normalizeWhitespace(text);

  record.marketplace = 'Generico';
  record.tipo_documento = 'Texto/OCR generico';
  record.cep_numerico = normalizeCepNumber(matchFirst(src, [/CEP\s*:?\s*([0-9 .-]{8,12})/i, /\b([0-9]{5}[- ]?[0-9]{3})\b/]));
  record.cep = normalizeCep(record.cep_numerico);
  record.endereco = normalizeWhitespace(matchFirst(src, [/Endere[cç]o\s*:\s*([^\n]+)/i, /((?:Rua|Avenida|Av\.|Travessa|Estrada)\s+[^\n]+)/i]));
  record.bairro = normalizeName(matchFirst(src, [/Bairro\s*:\s*([^\n]+)/i]));
  record.cidade = normalizeName(matchFirst(src, [/Cidade\s*:\s*([^\n]+)/i]));
  record.pedido = matchFirst(src, [/Pedido\s*:\s*([A-Z0-9-]+)/i]);
  record.nf = matchFirst(src, [/NF\s*[:\s]\s*(\d+)/i]);
  record.envio_id = onlyDigits(matchFirst(src, [/Envio\s*:\s*([0-9 ]+)/i]));
  record.venda_id = onlyDigits(matchFirst(src, [/Venda\s*:\s*([0-9 ]+)/i]));
  record.pack_id = onlyDigits(matchFirst(src, [/Pack\s*ID\s*:\s*([0-9 ]+)/i]));
  record.codigos = collectCodes(src);
  record.datas_encontradas = collectDates(src);

  const destinatario = splitNameAndUser(matchFirst(src, [/Destinat[áa]rio\s*:\s*([^\n]+)/i, /Cliente\s*:\s*([^\n]+)/i, /Nome\s*:\s*([^\n]+)/i]));
  record.destinatario_nome = normalizeName(destinatario.name);
  record.destinatario_usuario = destinatario.user;

  return finalizeRecord(record, ['cep', 'endereco']);
}

function extractAllTextData(text, filePath, pageNumber) {
  const record = createBaseRecord(filePath, pageNumber, text);
  const src = String(text || '');

  record.marketplace = 'Geral';
  record.tipo_documento = 'Processamento Geral';
  record.status_extracao = 'success';
  record.observacoes = ' dados extraidos no modo Geral';

  const linhas = src.split(/\r?\n/).filter((linha) => linha.trim().length > 0);
  const dadosOrganizados = linhas.map((linha, indice) => `Linha ${indice + 1}: ${linha.trim()}`).join('\n');

  record.codigos = collectCodes(src);
  record.datas_encontradas = collectDates(src);

  record.endereco = normalizeWhitespace(matchFirst(src, [/Endere[cç]o[:\s]*([^\n]+)/i, /((?:Rua|Avenida|Av\.|Travessa|Estrada)[^\n]+)/i]));
  record.bairro = normalizeWhitespace(matchFirst(src, [/Bairro[:\s]*([^\n]+)/i]));
  record.cidade = normalizeWhitespace(matchFirst(src, [/Cidade[:\s]*([^\n]+)/i]));
  record.cep = normalizeCep(matchFirst(src, [/CEP[:\s]*([0-9 -]+)/i, /\b([0-9]{5}[- ]?[0-9]{3})\b/]));

  record.pedido = matchFirst(src, [/pedido[:\s]*([a-z0-9-]+)/i]) || matchFirst(src, [/\b(PED|Ped|Order)[-:\s]*([0-9-]+)/i]);
  record.venda_id = matchFirst(src, [/venda[:\s]*([0-9]+)/i]) || matchFirst(src, [/\b2\d{15}\b/]);
  record.nf = matchFirst(src, [/NF[:\s]*([0-9]+)/i]) || matchFirst(src, [/\bNFe[-:\s]*([0-9]+)/i]);

  const destinatario = splitNameAndUser(
    matchFirst(src, [/destinat[áa]rio[:\s]*([^\n]+)/i]) ||
    matchFirst(src, [/cliente[:\s]*([^\n]+)/i]) ||
    matchFirst(src, [/nome[:\s]*([^\n]+)/i])
  );
  record.destinatario_nome = normalizeName(destinatario.name);
  record.destinatario_usuario = destinatario.user;

  record.texto_completo_ocr = dadosOrganizados;

  return record;
}

module.exports = { extractGenericText, extractAllTextData };
