const { createBaseRecord, finalizeRecord } = require('./baseRecord');
const {
  collectCodes,
  collectDates,
  lines,
  matchFirst,
  normalizeCep,
  normalizeCepNumber,
  normalizeName,
  normalizeUpperWord,
  normalizeWhitespace,
  onlyDigits,
  sectionBetween,
  splitNameAndUser,
} = require('../utils/text');

function extractMercadoLivre(text, filePath, pageNumber) {
  const record = createBaseRecord(filePath, pageNumber, text);
  const src = normalizeWhitespace(text);
  const list = lines(src);

  record.marketplace = 'Mercado Livre';
  record.tipo_documento = 'Envio Flex';
  record.data_envio = matchFirst(src, [/\b(\d{2}\s*(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ))\b/i]);
  record.venda_id = onlyDigits(matchFirst(src, [/Venda\s*:\s*([0-9 ]{8,})/i, /\b(2\d{15})\b/i]));
  record.pack_id = onlyDigits(matchFirst(src, [/Pack\s*ID\s*:\s*([0-9 ]{8,})/i]));
  record.envio_id = onlyDigits(matchFirst(src, [/Envio\s*:\s*([0-9 ]{8,})/i]));
  record.cep_numerico = normalizeCepNumber(matchFirst(src, [/CEP\s*:\s*([0-9 .-]{8,12})/i]));
  record.cep = normalizeCep(record.cep_numerico);
  record.tipo_endereco = normalizeUpperWord(matchFirst(src, [/\b(RESIDENCIAL|COMERCIAL)\b/i]));
  record.endereco = normalizeWhitespace(matchFirst(src, [/Endere[cç]o\s*:\s*([^\n]+)/i]));
  record.bairro = normalizeName(matchFirst(src, [/Bairro\s*:\s*([^\n]+)/i]));
  record.complemento = sectionBetween(src, /Complemento\s*:\s*/i, /Destinat[áa]rio\s*:/i);
  record.codigos = collectCodes(src);
  record.datas_encontradas = collectDates(src);

  const destinatarioRaw = matchFirst(src, [/Destinat[áa]rio\s*:\s*([\s\S]+?)(?:\n\s*$|$)/i]);
  const destinatario = splitNameAndUser(destinatarioRaw.replace(/\n/g, ' '));
  record.destinatario_nome = normalizeName(destinatario.name);
  record.destinatario_usuario = destinatario.user;

  const headerEnd = list.findIndex((line) => /Envio\s*Flex/i.test(line));
  const firstAddressLine = list.findIndex((line) => /Endere[cç]o\s*:/i.test(line));
  if (list[0]) record.remetente_nome = list[0];
  if (headerEnd > 0) {
    record.remetente_endereco = list.slice(1, headerEnd).filter((line) => !/Venda|Pack\s*ID|Envio/i.test(line)).join(' | ');
  }

  const cepLineIndex = list.findIndex((line) => /CEP\s*:/i.test(line));
  const typeLineIndex = list.findIndex((line) => /^(RESIDENCIAL|COMERCIAL)$/i.test(line));
  if (cepLineIndex >= 0 && typeLineIndex > cepLineIndex) {
    const routeLines = list
      .slice(cepLineIndex + 1, typeLineIndex)
      .filter((line) => !/^CEP\s*:?/i.test(line) && !/^\d{8}$/.test(line.replace(/\D/g, '')));
    record.rota = routeLines[0] || '';
    record.sub_regiao = routeLines.slice(1).join(' | ');
    record.bairro_rota = record.sub_regiao;
  }

  if (!record.cidade && record.endereco.includes(',')) {
    const parts = record.endereco.split(',').map((part) => part.trim()).filter(Boolean);
    record.cidade = normalizeName(parts[parts.length - 1] || '');
  }
  if (!record.cidade && firstAddressLine >= 0) record.cidade = normalizeName(matchFirst(list[firstAddressLine], [/,(.+)$/]));

  return finalizeRecord(record, ['cep', 'endereco', 'destinatario_nome']);
}

module.exports = { extractMercadoLivre };
