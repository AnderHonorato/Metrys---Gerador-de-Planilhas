function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/[ ]+\n/g, '\n')
    .trim();
}

function normalizeCep(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 8) return String(value || '').trim();
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeCepNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 8 ? digits : '';
}

function normalizeName(value) {
  return normalizeWhitespace(value).replace(/\s+/g, ' ').trim();
}

function normalizeUpperWord(value) {
  return normalizeWhitespace(value).toUpperCase();
}

function normalizeDate(value) {
  const cleaned = normalizeWhitespace(value);
  const match = cleaned.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!match) return cleaned;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${day}/${month}/${year}`;
}

function collectCodes(text) {
  const matches = String(text || '').match(/\b(?:BR[A-Z0-9]{8,}|[A-Z0-9]{10,}|\d{10,})\b/g) || [];
  return [...new Set(matches)].join(' | ');
}

function collectDates(text) {
  const matches = String(text || '').match(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g) || [];
  return [...new Set(matches.map(normalizeDate))].join(' | ');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function lines(text) {
  return normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match) return normalizeWhitespace(match[1] || match[0]);
  }
  return '';
}

function sectionBetween(text, startPattern, endPattern) {
  const src = String(text || '');
  const start = src.search(startPattern);
  if (start < 0) return '';
  const after = src.slice(start).replace(startPattern, '');
  const end = after.search(endPattern);
  return normalizeWhitespace(end < 0 ? after : after.slice(0, end));
}

function splitNameAndUser(value) {
  const cleaned = normalizeWhitespace(value);
  const match = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { name: cleaned, user: '' };
  return { name: normalizeWhitespace(match[1]), user: normalizeWhitespace(match[2]) };
}

module.exports = {
  normalizeWhitespace,
  normalizeCep,
  normalizeCepNumber,
  normalizeName,
  normalizeUpperWord,
  normalizeDate,
  collectCodes,
  collectDates,
  onlyDigits,
  lines,
  matchFirst,
  sectionBetween,
  splitNameAndUser,
};
