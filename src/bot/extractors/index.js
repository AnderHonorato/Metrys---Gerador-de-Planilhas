const { extractMercadoLivre } = require('./mercadoLivreExtractor');
const { extractShopee } = require('./shopeeExtractor');
const { extractGenericText } = require('./genericTextExtractor');
const { extractAllTextData } = require('./genericTextExtractor');

function safeProgress(progress, payload) {
  if (typeof progress === 'function') progress({ ts: new Date().toISOString(), ...payload });
}

function detectDocumentType(text) {
  const src = String(text || '').toLowerCase();
  const hasShopee = src.includes('entrega direta') || (src.includes('pedido')
    && (src.includes('remetente') || src.includes('data de entrega'))
    && ['danfe', 'entrega direta', 'destinat'].some((term) => src.includes(term)));
  if (hasShopee || src.includes('shopee') || src.includes('xhopee')) return 'shopee';

  if (src.includes('goose guardian')) return 'mercado_livre';
  if (/\b2\d{15}\b/.test(src)) return 'mercado_livre';
  const hasMl = ['envio flex', 'destinat', 'cep'].every((term) => src.includes(term))
    && ['venda', 'pack id', 'envio'].some((term) => src.includes(term));
  if (hasMl || src.includes('mercado livre')) return 'mercado_livre';
  return 'generic';
}

function extractStructuredData(text, filePath, pageNumber, tipoProcessamento) {
  if (tipoProcessamento === 'geral' || tipoProcessamento === 'geral') {
    return extractAllTextData(text, filePath, pageNumber);
  }

  const type = detectDocumentType(text);
  if (type === 'mercado_livre') return extractMercadoLivre(text, filePath, pageNumber);
  if (type === 'shopee') return extractShopee(text, filePath, pageNumber);
  return extractGenericText(text, filePath, pageNumber);
}

module.exports = { detectDocumentType, extractStructuredData };
