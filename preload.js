/**
 * preload.js - Ponte segura entre o processo principal e o renderizador
 * Expoe apenas as APIs necessarias via contextBridge
 */
const { contextBridge, ipcRenderer } = require('electron');

var tratadorProgresso = null;
var ouvintesProgresso = [];

contextBridge.exposeInMainWorld('botPlanilha', {
  // Controles da janela
  janela: {
    minimizar: function () { return ipcRenderer.invoke('janela:minimizar'); },
    maximizar: function () { return ipcRenderer.invoke('janela:maximizar'); },
    fechar: function () { return ipcRenderer.invoke('janela:fechar'); },
  },

  // Manipulacao de arquivos
  arquivos: {
    selecionar: function () { return ipcRenderer.invoke('files:select'); },
    abrir: function (caminho) { return ipcRenderer.invoke('file:open', caminho); },
    mostrarNaPasta: function (caminho) { return ipcRenderer.invoke('file:show', caminho); },
  },

  // Bot de processamento de planilhas
  bot: {
    processar: function (caminhos, opcoes) { return ipcRenderer.invoke('bot:processar', caminhos, opcoes); },
    processarTexto: function (texto) { return ipcRenderer.invoke('bot:processarTexto', texto); },
    cancelar: function () { return ipcRenderer.invoke('bot:cancelar'); },
    formatos: function () { return ipcRenderer.invoke('bot:formatos'); },
    processarGeral: function (caminhos, opcoes) { return ipcRenderer.invoke('bot:processarGeral', caminhos, opcoes); },

    // Eventos de progresso (suporta multiplos ouvintes)
    onProgress: function (callback) {
      ouvintesProgresso.push(callback);

      if (ouvintesProgresso.length === 1) {
        if (tratadorProgresso) ipcRenderer.removeListener('bot:progress', tratadorProgresso);
        tratadorProgresso = function (_evento, payload) {
          ouvintesProgresso.forEach(function (cb) { cb(payload); });
        };
        ipcRenderer.on('bot:progress', tratadorProgresso);
      }
    },

    removeProgressListener: function (callback) {
      ouvintesProgresso = ouvintesProgresso.filter(function (cb) { return cb !== callback; });
    },
  },

  // Gerenciamento de conversas
  conv: {
    listar: function () { return ipcRenderer.invoke('conv:list'); },
    obter: function (id) { return ipcRenderer.invoke('conv:get', id); },
    criar: function (titulo, modelo) { return ipcRenderer.invoke('conv:create', titulo, modelo); },
    excluir: function (id) { return ipcRenderer.invoke('conv:delete', id); },
    renomear: function (id, titulo) { return ipcRenderer.invoke('conv:rename', id, titulo); },
  },

  // Chat com IA
  ai: {
    enviar: function (idConv, modelo, texto) { return ipcRenderer.invoke('ai:chat', idConv, modelo, texto); },
    modelos: function () { return ipcRenderer.invoke('ai:models'); },
    validarAPI: function (provedor, apiKey) { return ipcRenderer.invoke('ai:validarAPI', provedor, apiKey); },
  },

  // Configuracoes persistentes
  config: {
    obter: function () { return ipcRenderer.invoke('config:get'); },
    salvar: function (config) { return ipcRenderer.invoke('config:save', config); },
  },
});
