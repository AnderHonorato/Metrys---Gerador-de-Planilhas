/**
 * main.js - Processo principal do Electron
 * Metrys Planilhas - Bot local com chat IA + gerador de planilhas Excel
 * Desenvolvido por Anderson Honorato - https://anderhonorato.github.io/links
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Carrega variaveis de ambiente do arquivo .env, inclusive no app empacotado.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function carregarConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (_) {
    return { tema: 'dark', apiKey: process.env.SPIDERX_API_KEY || '' };
  }
}

function salvarConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

let CONFIG_APP = carregarConfig();
let CHAVE_API = CONFIG_APP.apiKey || process.env.SPIDERX_API_KEY || '';
console.log('[MAIN] chave API carregada:', CHAVE_API ? 'sim (' + CHAVE_API.length + ' chars)' : 'NAO');

// Encerra o processo em caso de falha no processo principal.
process.on('uncaughtException', function (erro) {
  console.error('[ERRO] Nao tratado:', erro && erro.message);
  app.exit(1);
});

process.on('unhandledRejection', function (motivo) {
  console.error('[ERRO] Rejeicao nao tratada:', motivo && motivo.message);
  app.exit(1);
});

// Modulos internos
const { processFiles, processTextContent } = require('./src/bot');
const { chamarAPI, validarAPIExterna, getMODELOS, MODELOS_PADRAO, MODELOS_EXTERNOS } = require('./src/ia/conexaoAPI');

// ==================== CONFIGURACOES ====================
const PASTA_CONVERSAS = path.join(app.getPath('userData'), 'conversas');

// Cache de conversas em memoria
let cacheConv = {};
let indiceConv = [];

let janelaPrincipal = null;
let processamentoCancelado = false;

// ==================== JANELA PRINCIPAL ====================

function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    frame: false,
    backgroundColor: '#10100f',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  janelaPrincipal.loadFile('index.html');
}

// ==================== CICLO DE VIDA ====================

app.whenReady().then(function () {
  // Garante que a pasta de conversas existe
  if (!fs.existsSync(PASTA_CONVERSAS)) {
    fs.mkdirSync(PASTA_CONVERSAS, { recursive: true });
  }
  carregarConversas();
  criarJanela();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) criarJanela();
});

// ==================== IPC: JANELA ====================

ipcMain.handle('janela:minimizar', function () {
  if (janelaPrincipal) janelaPrincipal.minimize();
});

ipcMain.handle('janela:maximizar', function () {
  if (!janelaPrincipal) return false;
  if (janelaPrincipal.isMaximized()) janelaPrincipal.unmaximize();
  else janelaPrincipal.maximize();
  return janelaPrincipal.isMaximized();
});

ipcMain.handle('janela:fechar', function () {
  if (janelaPrincipal) janelaPrincipal.close();
});

// ==================== IPC: ARQUIVOS ====================

ipcMain.handle('files:select', async function () {
  var resultado = await dialog.showOpenDialog(janelaPrincipal, {
    title: 'Selecionar arquivos para gerar planilha',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Arquivos aceitos', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'zpl', 'epl', 'tspl', 'prn', 'lbl', 'txt', 'csv', 'xlsx'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });

  if (resultado.canceled) return [];
  return resultado.filePaths;
});

ipcMain.handle('file:open', async function (_evento, caminho) {
  // Se for URL, abre no navegador
  if (String(caminho || '').startsWith('http')) {
    shell.openExternal(caminho);
    return;
  }
  shell.openPath(caminho);
});

ipcMain.handle('file:show', async function (_evento, caminho) {
  shell.showItemInFolder(caminho);
});

// ==================== IPC: BOT PLANILHA ====================

ipcMain.handle('bot:processar', async function (evento, caminhos, opcoes) {
  processamentoCancelado = false;
  var emissor = evento.sender;
  var emitirProgresso = function (payload) {
    emissor.send('bot:progress', payload);
  };
  var config = { isCancelled: function () { return processamentoCancelado } };
  if (opcoes) {
    if (opcoes.formatos) config.formatos = opcoes.formatos;
    if (opcoes.modo) config.modo = opcoes.modo;
    if (opcoes.tipo) config.tipo = opcoes.tipo;
  }
  console.log('[DEBUG main] processando com config:', JSON.stringify(config));
  var result = await processFiles(caminhos, emitirProgresso, config);
  console.log('[DEBUG main] result returned:', JSON.stringify(result).slice(0, 300));
  return result;
});

ipcMain.handle('bot:processarGeral', async function (evento, caminhos, opcoes) {
  processamentoCancelado = false;
  var emissor = evento.sender;
  var emitirProgresso = function (payload) {
    emissor.send('bot:progress', payload);
  };
  var config = { isCancelled: function () { return processamentoCancelado }, tipo: 'geral' };
  if (opcoes) {
    if (opcoes.formatos) config.formatos = opcoes.formatos;
    if (opcoes.modo) config.modo = opcoes.modo;
  }
  console.log('[DEBUG main] processando em modo GERAL com config:', JSON.stringify(config));
  var result = await processFiles(caminhos, emitirProgresso, config);
  console.log('[DEBUG main] result returned:', JSON.stringify(result).slice(0, 300));
  return result;
});

ipcMain.handle('bot:cancelar', async function () {
  processamentoCancelado = true;
  return true;
});

ipcMain.handle('bot:formatos', function () {
  return require('./src/bot/constants').FORMATOS_OPCOES;
});

ipcMain.handle('bot:processarTexto', async function (evento, texto) {
  var emissor = evento.sender;
  var emitirProgresso = function (payload) {
    emissor.send('bot:progress', payload);
  };
  return processTextContent(texto, emitirProgresso);
});

// ==================== IPC: CONFIGURACOES ====================

ipcMain.handle('config:get', function () {
  CONFIG_APP = carregarConfig();
  CHAVE_API = CONFIG_APP.apiKey || process.env.SPIDERX_API_KEY || '';
  return {
    tema: CONFIG_APP.tema || 'dark',
    apiKey: CHAVE_API,
    apisExternas: CONFIG_APP.apisExternas || {},
  };
});

ipcMain.handle('config:save', function (_evento, config) {
  CONFIG_APP = {
    tema: config && config.tema === 'light' ? 'light' : 'dark',
    apiKey: String(config && config.apiKey || '').trim(),
    apisExternas: config && config.apisExternas ? config.apisExternas : {},
  };
  CHAVE_API = CONFIG_APP.apiKey || process.env.SPIDERX_API_KEY || '';
  salvarConfig(CONFIG_APP);
  return { ok: true, tema: CONFIG_APP.tema, apiKey: CHAVE_API, apisExternas: CONFIG_APP.apisExternas };
});

// ==================== GERENCIAMENTO DE CONVERSAS ====================

function carregarConversas() {
  try {
    var arquivos = fs.readdirSync(PASTA_CONVERSAS).filter(function (f) { return f.endsWith('.json'); });
    indiceConv = [];

    arquivos.forEach(function (arquivo) {
      try {
        var cru = fs.readFileSync(path.join(PASTA_CONVERSAS, arquivo), 'utf8');
        var conv = JSON.parse(cru);
        cacheConv[conv.id] = conv;
        indiceConv.push({
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          model: conv.model,
        });
      } catch (_) {
        // Ignora arquivos corrompidos
      }
    });

    // Ordena da mais recente para a mais antiga
    indiceConv.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } catch (_) {
    // Pasta pode nao existir ainda
  }
}

function salvarConversa(conv) {
  cacheConv[conv.id] = conv;

  // Atualiza o indice
  var existente = indiceConv.findIndex(function (c) { return c.id === conv.id; });
  if (existente >= 0) {
    indiceConv[existente] = { id: conv.id, title: conv.title, createdAt: conv.createdAt, model: conv.model };
  } else {
    indiceConv.unshift({ id: conv.id, title: conv.title, createdAt: conv.createdAt, model: conv.model });
  }

  indiceConv.sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Salva no disco
  fs.writeFileSync(
    path.join(PASTA_CONVERSAS, conv.id + '.json'),
    JSON.stringify(conv, null, 2)
  );
}

function excluirConversa(id) {
  delete cacheConv[id];
  indiceConv = indiceConv.filter(function (c) { return c.id !== id; });

  try {
    fs.unlinkSync(path.join(PASTA_CONVERSAS, id + '.json'));
  } catch (_) {
    // Arquivo ja nao existe
  }
}

// ==================== IPC: CONVERSAS ====================

ipcMain.handle('conv:list', function () {
  return indiceConv;
});

ipcMain.handle('conv:get', function (_evento, id) {
  return cacheConv[id] || null;
});

ipcMain.handle('conv:create', function (_evento, titulo, modelo) {
  var conv = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: titulo || 'Nova conversa',
    model: modelo || 'metrys-pro',
    createdAt: new Date().toISOString(),
    messages: [],
  };
  salvarConversa(conv);
  return conv;
});

ipcMain.handle('conv:delete', function (_evento, id) {
  excluirConversa(id);
  return true;
});

ipcMain.handle('conv:rename', function (_evento, id, titulo) {
  var conv = cacheConv[id];
  if (!conv) return false;
  conv.title = titulo;
  salvarConversa(conv);
  return true;
});

// ==================== IPC: IA (CHAT) ====================

ipcMain.handle('ai:chat', async function (evento, idConv, chaveModelo, texto) {
  var conv = cacheConv[idConv];
  if (!conv) throw new Error('Conversa nao encontrada.');

  var msgUsuario = { role: 'user', content: texto, time: new Date().toISOString() };
  conv.messages.push(msgUsuario);
  salvarConversa(conv);

  var historico = conv.messages
    .filter(function (m) { return !m.error; })
    .slice(-30)
    .map(function (m) { return { role: m.role, content: m.content }; });

  var chavesExternas = CONFIG_APP.apisExternas || {};

  var resultado;
  try {
    if (/criador|criou|desenvolvedor|quem fez/i.test(String(texto || ''))) {
      resultado = {
        conteudo: 'Fui criado por Anderson Honorato. Conheca mais em https://anderhonorato.github.io/links',
        modelo: 'Metrys',
      };
    } else {
      resultado = await chamarAPI(chaveModelo, CHAVE_API, texto, historico, chavesExternas);
    }
  } catch (erro) {
    conv.messages.push({
      role: 'assistant',
      content: 'Nao foi possivel obter resposta no momento. Tente novamente.',
      time: new Date().toISOString(),
      error: true,
    });
    salvarConversa(conv);
    return { ok: false, erro: 'Nao foi possivel obter resposta no momento. Tente novamente.' };
  }

  var msgIA = {
    role: 'assistant',
    content: resultado.conteudo,
    time: new Date().toISOString(),
    model: resultado.modelo,
  };
  conv.messages.push(msgIA);
  salvarConversa(conv);

  return { ok: true, conteudo: resultado.conteudo, modelo: resultado.modelo, content: resultado.conteudo, model: resultado.modelo };
});

ipcMain.handle('ai:models', function () {
  var chavesExternas = CONFIG_APP.apisExternas || {};
  var todosModelos = getMODELOS(chavesExternas);
  return Object.keys(todosModelos).map(function (chave) {
    return {
      id: chave,
      name: todosModelos[chave].nome,
      icon: todosModelos[chave].icone,
    };
  });
});

ipcMain.handle('ai:validarAPI', async function (_evento, provedor, apiKey) {
  if (!provedor || !apiKey) return { ok: false, erro: 'Provedor e chave sao obrigatorios.' };
  return await validarAPIExterna(provedor, apiKey);
});
