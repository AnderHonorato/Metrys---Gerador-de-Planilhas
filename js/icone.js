/**
 * icone.js - Funcao que gera o icone animado do Metrys (estrela com rastro arco-iris)
 * Copiado fielmente do Metrys original
 */
function iconeMetrys(tamanho, estado, uid) {
  var st = estado || 'parado';
  var uidLimpo = (uid || 'x').replace(/[^a-zA-Z0-9]/g, '');
  var animando = st !== 'parado' && st !== 'erro';
  var ehErro = st === 'erro';

  var classeAnel = '';
  if (st === 'pensando' || st === 'pulse') classeAnel = ' is-rainbow-slow';
  else if (st === 'gerando') classeAnel = ' is-rainbow-fast';
  else if (st === 'importante') classeAnel = ' is-rainbow-medium';
  else if (st === 'finalizando') classeAnel = ' is-rainbow-finish';

  var svg =
    '<svg class="metrys-icon" viewBox="0 0 56 56" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
    '<linearGradient id="mr-' + uidLimpo + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#f97316"/>' +
    '<stop offset="18%" stop-color="#facc15"/>' +
    '<stop offset="38%" stop-color="#22c55e"/>' +
    '<stop offset="58%" stop-color="#06b6d4"/>' +
    '<stop offset="78%" stop-color="#2563eb"/>' +
    '<stop offset="100%" stop-color="#8b5cf6"/>' +
    '</linearGradient>' +
    '<linearGradient id="ms-' + uidLimpo + '" x1="8%" y1="8%" x2="92%" y2="92%">' +
    '<stop offset="0%" stop-color="#f97316">' +
    '<animate attributeName="stop-color" values="#f97316;#facc15;#22c55e;#06b6d4;#2563eb;#f97316" dur="4s" repeatCount="indefinite"/>' +
    '</stop>' +
    '<stop offset="50%" stop-color="#facc15">' +
    '<animate attributeName="stop-color" values="#facc15;#22c55e;#06b6d4;#2563eb;#8b5cf6;#facc15" dur="4s" repeatCount="indefinite"/>' +
    '</stop>' +
    '<stop offset="100%" stop-color="#2563eb">' +
    '<animate attributeName="stop-color" values="#2563eb;#8b5cf6;#f97316;#facc15;#06b6d4;#2563eb" dur="4s" repeatCount="indefinite"/>' +
    '</stop>' +
    '</linearGradient>' +
    '</defs>' +
    (animando
      ? '<g class="rainbow-rotor' + classeAnel + '">' +
        '<circle class="trail trail-head" cx="28" cy="28" r="18.5" fill="none" stroke="url(#mr-' + uidLimpo + ')" stroke-linecap="round"/>' +
        '<circle class="trail trail-mid" cx="28" cy="28" r="18.5" fill="none" stroke="url(#mr-' + uidLimpo + ')" stroke-linecap="round"/>' +
        '<circle class="trail trail-tail" cx="28" cy="28" r="18.5" fill="none" stroke="url(#mr-' + uidLimpo + ')" stroke-linecap="round"/>' +
        '</g>'
      : '') +
    '<g class="metrys-star-wrap' + (animando ? ' is-star-thinking' : '') + '">' +
    '<path class="metrys-star" fill="' + (ehErro ? '#6b7280' : 'url(#ms-' + uidLimpo + ')') + '" d="' +
    'M28 12 C28 12 32.85 23.15 32.85 23.15 ' +
    'C32.85 23.15 44 28 44 28 ' +
    'C44 28 32.85 32.85 32.85 32.85 ' +
    'C32.85 32.85 28 44 28 44 ' +
    'C28 44 23.15 32.85 23.15 32.85 ' +
    'C23.15 32.85 12 28 12 28 ' +
    'C12 28 23.15 23.15 23.15 23.15 ' +
    'C23.15 23.15 28 12 28 12 Z' +
    '"/>' +
    '</g>' +
    '</svg>';

  var classeWrap = 'metrys-icon-wrap';
  if (!animando) classeWrap += ' is-icon-idle';
  if (ehErro) classeWrap += ' is-icon-error';

  return '<div class="' + classeWrap + '" style="width:' + tamanho + 'px;height:' + tamanho + 'px">' + svg + '</div>';
}
