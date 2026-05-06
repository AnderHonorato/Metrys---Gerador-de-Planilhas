const TEMPLATE_COLUMNS = [
  'PLATAFORMA',
  'ID DA VENDA',
  'DATA',
  'REGIÃO',
  'TAMANHO',
  'TIPO',
  'NF',
  'CEP',
  'FRETE',
];

const FORMATOS_OPCOES = [
  { id: 'xlsx', nome: 'Excel (XLSX)', extensao: '.xlsx', descricao: 'Planilha do Excel' },
  { id: 'csv', nome: 'CSV', extensao: '.csv', descricao: 'Valores separados por ponto e virgula' },
  { id: 'txt', nome: 'Texto (TXT)', extensao: '.txt', descricao: 'Arquivo de texto simples' },
  { id: 'pdf', nome: 'PDF', extensao: '.pdf', descricao: 'Relatorio em PDF' },
  { id: 'png', nome: 'PNG', extensao: '.png', descricao: 'Imagem PNG da planilha' },
  { id: 'jpg', nome: 'JPG', extensao: '.jpg', descricao: 'Imagem JPG da planilha' },
  { id: 'jpeg', nome: 'JPEG', extensao: '.jpeg', descricao: 'Imagem JPEG da planilha' },
  { id: 'zpl', nome: 'ZPL', extensao: '.zpl', descricao: 'Arquivo para impressoras Zebra' },
  { id: 'epl', nome: 'EPL', extensao: '.epl', descricao: 'Arquivo para impressoras Eltron' },
  { id: 'tspl', nome: 'TSPL', extensao: '.tspl', descricao: 'Arquivo para impressoras TSC' },
  { id: 'prn', nome: 'PRN', extensao: '.prn', descricao: 'Arquivo de impressao' },
  { id: 'lbl', nome: 'LBL', extensao: '.lbl', descricao: 'Arquivo de etiqueta' },
];

const AUDIT_COLUMNS = [
  'origem_arquivo',
  'total_paginas_detectadas',
  'total_paginas_processadas',
  'total_registros_extraidos',
  'paginas_com_erro',
  'paginas_sem_dados',
  'data_processamento',
  'duracao_processamento',
  'status_final',
];

const OCR_COLUMNS = ['origem_arquivo', 'pagina', 'texto_completo_ocr'];

module.exports = { TEMPLATE_COLUMNS, AUDIT_COLUMNS, OCR_COLUMNS, FORMATOS_OPCOES };
