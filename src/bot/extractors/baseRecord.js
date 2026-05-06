const path = require('path');

function createBaseRecord(filePath, pageNumber, text) {
  return {
    origem_arquivo: path.basename(filePath),
    marketplace: '',
    pagina: pageNumber,
    tipo_documento: '',
    destinatario_nome: '',
    destinatario_usuario: '',
    endereco: '',
    bairro: '',
    cep: '',
    cep_numerico: '',
    cidade: '',
    rota: '',
    sub_regiao: '',
    tipo_endereco: '',
    complemento: '',
    pedido: '',
    venda_id: '',
    pack_id: '',
    envio_id: '',
    nf: '',
    serie: '',
    emissao: '',
    data_envio: '',
    data_entrega: '',
    remetente_nome: '',
    remetente_endereco: '',
    remetente_cep: '',
    codigo_qr: '',
    codigos: '',
    datas_encontradas: '',
    rota_numero: '',
    cep_rota: '',
    bairro_rota: '',
    status_extracao: 'parcial',
    observacoes: '',
    texto_completo_ocr: text || '',
  };
}

function finalizeRecord(record, requiredFields) {
  const extractedFields = [
    'cep', 'destinatario_nome', 'endereco', 'bairro', 'cidade', 'pedido', 'venda_id', 'pack_id', 'envio_id', 'nf', 'data_entrega', 'codigo_qr', 'codigos'
  ];
  const hasAnyData = extractedFields.some((field) => Boolean(record[field]));
  if (!hasAnyData) {
    record.status_extracao = 'erro';
    record.observacoes = record.observacoes ? `${record.observacoes}; Nenhum campo estruturado extraido` : 'Nenhum campo estruturado extraido';
    return record;
  }

  const missing = requiredFields.filter((field) => !record[field]);
  if (missing.length === 0) {
    record.status_extracao = 'success';
    return record;
  }

  record.status_extracao = 'parcial';
  const current = record.observacoes ? `${record.observacoes}; ` : '';
  record.observacoes = `${current}Campos nao encontrados: ${missing.join(', ')}`;
  return record;
}

module.exports = { createBaseRecord, finalizeRecord };
