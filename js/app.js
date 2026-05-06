const state = {
  files: [],
  loading: false,
  activeConvId: null,
  activeModel: 'metrys-pro',
  lastResult: null,
  previewOpen: false,
  panelTab: 'planilha',
};

function $(id) { return document.getElementById(id); }
function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function now() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function toggleSidebar() { $('sidebar').classList.toggle('closed'); }
function toggleDrop(id) {
  ['model-dd'].forEach(function (d) { if (d !== id) $(d)?.classList.remove('open'); });
  $(id)?.classList.toggle('open');
}
function togglePreview() {
  state.previewOpen = !state.previewOpen;
  $('preview-panel').classList.toggle('open', state.previewOpen);
  $('btn-preview').classList.toggle('active', state.previewOpen);
}
function switchTab(tab) {
  state.panelTab = tab;
  document.querySelectorAll('.ppane').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('.ptab').forEach(function (el) { el.classList.remove('active'); });
  $('pane-' + tab)?.classList.add('active');
  var tabBtn = document.querySelector('.ptab[onclick*="' + tab + '"]');
  if (tabBtn) tabBtn.classList.add('active');
}
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
}

function updateSend() {
  var hasFiles = state.files.length > 0;
  var hasText = $('chat-inp').value.trim().length > 0;
  $('send-btn').disabled = state.loading || (!hasFiles && !hasText);
  $('quick-generate').disabled = state.loading || !hasFiles;
  $('file-count-side').textContent = hasFiles ? state.files.length + ' arquivo(s)' : 'Nenhum arquivo';
}

function setStatus(text, cls) {
  var pill = $('status-pill');
  if (pill) { pill.className = 'status-pill ' + (cls || ''); pill.textContent = text; }
  $('status-text').textContent = text;
}

function scrollBottom() {
  var area = $('msg-area');
  area.scrollTop = area.scrollHeight;
}

function addProcessLog(message, level) {
  var log = $('process-log');
  log.style.display = 'block';
  var entry = document.createElement('div');
  entry.className = 'log-entry ' + (level || 'info');
  entry.textContent = message;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function addBotMessage(message, level, extraHtml) {
  var row = document.createElement('div');
  row.className = 'bot-row';
  var cls = level === 'success' ? 'success' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : '';
  row.innerHTML = '<div class="bot-avatar">M</div><div class="bot-content"><div class="bot-title">Metrys Planilhas · ' + now() + '</div><div class="bot-text ' + cls + '">' + esc(message) + '</div>' + (extraHtml || '') + '</div>';
  $('msg-inner').appendChild(row);
  scrollBottom();
}

function addUserMessage(message) {
  var row = document.createElement('div');
  row.className = 'user-row';
  var files = state.files.map(function (f) { return '[anexo] ' + f.name; }).join('\n');
  row.innerHTML = '<div class="user-bubble">' + esc(message) + (files ? '\n\n' + esc(files) : '') + '</div><span class="msg-time">' + now() + '</span>';
  $('msg-inner').appendChild(row);
  scrollBottom();
}

function addAIMessage(content, model) {
  var row = document.createElement('div');
  row.className = 'bot-row';
  row.innerHTML = '<div class="bot-avatar ai-avatar">IA</div><div class="bot-content"><div class="bot-title">Metrys · ' + now() + '</div><div class="bot-text">' + formatAI(content) + '</div></div>';
  $('msg-inner').appendChild(row);
  scrollBottom();
}

function formatAI(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-card"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function addAIError(message) {
  var row = document.createElement('div');
  row.className = 'bot-row';
  row.innerHTML = '<div class="bot-avatar ai-avatar">!</div><div class="bot-content"><div class="bot-title">Metrys · ' + now() + '</div><div class="bot-text error">' + esc(message) + '</div></div>';
  $('msg-inner').appendChild(row);
  scrollBottom();
}

function renderPendingFiles() {
  var el = $('pending-files');
  el.innerHTML = '';
  state.files.forEach(function (file, index) {
    var item = document.createElement('div');
    item.className = 'pfile';
    item.innerHTML = '[anexo] ' + esc(file.name) + ' <button title="Remover" onclick="removeFile(' + index + ')">x</button>';
    el.appendChild(item);
  });
  updateSend();
}

function removeFile(index) {
  if (state.loading) return;
  state.files.splice(index, 1);
  renderPendingFiles();
}

async function selecionarArquivos() {
  if (state.loading) return;
  var paths = await window.botPlanilha.arquivos.selecionar();
  if (!paths || !paths.length) return;
  var known = new Set(state.files.map(function (f) { return f.path; }));
  paths.forEach(function (fp) {
    if (!known.has(fp)) state.files.push({ path: fp, name: fp.split(/[\\/]/).pop() });
  });
  renderPendingFiles();
  addBotMessage('Arquivo recebido. Clique em "Gerar planilha" na barra lateral para processar.', 'info');
}

function quickGenerate() {
  togglePreview();
  switchTab('planilha');
  $('process-log').innerHTML = '';
  $('process-log').style.display = 'block';
  addBotMessage('Iniciando geracao de planilha. Acompanhe o progresso no painel lateral.', 'info');
  doGenerate();
}

function handleKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMsg();
  }
}

async function sendMsg() {
  var message = $('chat-inp').value.trim();
  if (state.loading || (!message && !state.files.length)) return;

  if (state.files.length > 0) {
    addUserMessage(message || 'Gerar planilha do arquivo anexado.');
    $('chat-inp').value = '';
    $('chat-inp').style.height = 'auto';
    togglePreview();
    switchTab('planilha');
    $('process-log').innerHTML = '';
    $('process-log').style.display = 'block';
    addBotMessage('Iniciando geracao de planilha. Acompanhe o progresso no painel lateral.', 'info');
    doGenerate();
    return;
  }

  if (!state.activeConvId) {
    try {
      var title = message.slice(0, 40);
      var conv = await window.botPlanilha.conv.criar(title, state.activeModel);
      state.activeConvId = conv.id;
      $('conv-title').textContent = title;
      carregarConversas();
    } catch (e) {
      addBotMessage('Erro ao criar conversa: ' + e.message, 'error');
      return;
    }
  }

  var userText = message;
  addUserMessage(userText);
  $('chat-inp').value = '';
  $('chat-inp').style.height = 'auto';
  state.loading = true;
  updateSend();
  setStatus('Pensando', 'running');
  updateThinkContent('Processando mensagem com ' + state.activeModel + '...');

  try {
    var result = await window.botPlanilha.ai.enviar(state.activeConvId, state.activeModel, userText);
    addAIMessage(result.content, result.model);
    updateThinkContent('Resposta gerada com ' + result.model);
    setStatus('Pronto', '');
    if (state.activeConvId) {
      window.botPlanilha.conv.obter(state.activeConvId).then(function (c) {
        if (c) {
          var titles = c.messages.filter(function (m) { return m.role === 'user'; });
          if (titles.length === 1) {
            $('conv-title').textContent = userText.slice(0, 50);
            window.botPlanilha.conv.renomear(state.activeConvId, userText.slice(0, 50)).catch(function () {});
          }
        }
        carregarConversas();
      });
    }
  } catch (error) {
    addAIError(error.message);
    setStatus('Erro', 'warn');
  } finally {
    state.loading = false;
    updateSend();
  }
}

function updateThinkContent(text) {
  $('think-empty').style.display = 'none';
  $('think-content').style.display = 'block';
  $('think-content').textContent = text;
}

async function doGenerate() {
  if (!state.files.length) return;
  var filesToProcess = state.files.slice();
  state.loading = true;
  setStatus('Processando', 'running');
  updateSend();

  var progressHandler = function (payload) {
    if (payload.level === 'debug') return;
    addProcessLog(payload.message, payload.level);
    addBotMessage(payload.message, payload.level);
  };
  window.botPlanilha.bot.onProgress(progressHandler);

  try {
    var result = await window.botPlanilha.bot.processar(filesToProcess.map(function (f) { return f.path; }));
    state.lastResult = result;
    state.files = [];
    renderPendingFiles();
    addProcessLog('Planilha gerada: ' + result.fileName, 'success');
    var extra = '<div class="download-card"><div class="download-info"><strong>' + esc(result.fileName) + '</strong><span>' + esc(result.outputPath) + '</span><span>' + result.totalPaginas + ' pagina(s) · ' + result.totalRegistros + ' registro(s) · ' + result.duracaoSegundos + 's</span></div><div class="download-actions"><button class="small-btn primary" onclick="abrirPlanilha()">Baixar planilha</button><button class="small-btn" onclick="mostrarPlanilha()">Mostrar pasta</button></div></div>';
    addBotMessage('Planilha gerada com sucesso. Foram processadas ' + result.totalPaginas + ' pagina(s) e extraidos ' + result.totalRegistros + ' registro(s).', result.statusFinal === 'ok' ? 'success' : 'warn', extra);
    setStatus(result.statusFinal === 'ok' ? 'Concluido' : 'Concluido com alerta', result.statusFinal === 'ok' ? 'ok' : 'warn');
  } catch (error) {
    addBotMessage(error.message, 'error');
    addProcessLog('Erro: ' + error.message, 'error');
    setStatus('Erro', 'warn');
  } finally {
    state.loading = false;
    updateSend();
    window.botPlanilha.bot.removeProgressListener(progressHandler);
  }
}

function abrirPlanilha() {
  if (state.lastResult && state.lastResult.outputPath) window.botPlanilha.arquivos.abrir(state.lastResult.outputPath);
}

function mostrarPlanilha() {
  if (state.lastResult && state.lastResult.outputPath) window.botPlanilha.arquivos.mostrarNaPasta(state.lastResult.outputPath);
}

async function novaConversa() {
  if (state.loading) return;
  try {
    var conv = await window.botPlanilha.conv.criar('Nova conversa', state.activeModel);
    carregarConversa(conv.id);
  } catch (e) {
    addBotMessage('Erro ao criar conversa: ' + e.message, 'error');
  }
}

async function carregarConversa(id) {
  state.activeConvId = id;
  state.files = [];
  state.lastResult = null;
  $('msg-inner').innerHTML = '';
  $('chat-inp').value = '';
  renderPendingFiles();

  try {
    var conv = await window.botPlanilha.conv.obter(id);
    if (!conv) { renderGreeting(); return; }
    $('conv-title').textContent = conv.title || 'Conversa';
    state.activeModel = conv.model || 'metrys-pro';
    $('model-lbl').textContent = modelLabel(conv.model);

    if (conv.messages && conv.messages.length) {
      conv.messages.forEach(function (m) {
        if (m.role === 'user') {
          addUserMessage(m.content);
        } else if (m.error) {
          addAIError(m.content);
        } else {
          addAIMessage(m.content, m.model || '');
        }
      });
    }
  } catch (e) {
    renderGreeting();
  }

  carregarConversas();
}

async function carregarConversas() {
  try {
    var list = await window.botPlanilha.conv.listar();
    var el = $('conv-list');
    el.innerHTML = '';
    list.forEach(function (conv) {
      var item = document.createElement('div');
      item.className = 'conv-item' + (conv.id === state.activeConvId ? ' active' : '');
      item.innerHTML = '<span class="conv-name">' + esc(conv.title || 'Conversa') + '</span><button class="conv-del" onclick="event.stopPropagation();excluirConversa(\'' + conv.id + '\')">✕</button>';
      item.onclick = function () { carregarConversa(conv.id); };
      el.appendChild(item);
    });
  } catch (e) {}
}

async function excluirConversa(id) {
  if (state.loading) return;
  await window.botPlanilha.conv.excluir(id);
  if (state.activeConvId === id) {
    state.activeConvId = null;
    $('msg-inner').innerHTML = '';
    $('conv-title').textContent = 'Nova conversa';
    renderGreeting();
  }
  carregarConversas();
}

function modelLabel(id) {
  var map = { 'metrys-flash': 'Metrys Flash', 'metrys-core': 'Metrys Core', 'metrys-pro': 'Metrys Pro' };
  return map[id] || 'Metrys';
}

async function carregarModelos() {
  try {
    var modelos = await window.botPlanilha.ai.modelos();
    var dd = $('model-dd');
    dd.innerHTML = '';
    modelos.forEach(function (m) {
      var item = document.createElement('div');
      item.className = 'drop-item' + (m.id === state.activeModel ? ' active' : '');
      item.innerHTML = '<div class="drop-item-dot" style="background:var(--coral)"></div>' + m.name;
      item.onclick = function () {
        state.activeModel = m.id;
        $('model-lbl').textContent = m.name;
        $('model-dd').classList.remove('open');
        document.querySelectorAll('#model-dd .drop-item').forEach(function (o) { o.classList.remove('active'); });
        item.classList.add('active');
      };
      dd.appendChild(item);
    });
  } catch (e) {
    var dd = $('model-dd');
    dd.innerHTML = '<div class="drop-item active"><div class="drop-item-dot" style="background:var(--coral)"></div>Metrys Pro</div>';
  }
}

document.addEventListener('click', function (e) {
  ['model-dd'].forEach(function (id) {
    if (!e.target.closest('#' + id.split('-')[0] + '-wrap')) $(id)?.classList.remove('open');
  });
});

function renderGreeting() {
  $('msg-inner').innerHTML = '';
  var row = document.createElement('div');
  row.className = 'bot-row greeting';
  row.innerHTML = '<div class="bot-avatar ai-avatar">IA</div><div class="bot-content"><div class="bot-title">Metrys</div><div class="bot-text">Ola, sou o Metrys. Como posso ajudar?<br><br>Posso conversar ou processar arquivos PDF/Imagem para gerar planilhas Excel.<br><br>Anexe um arquivo e clique em "Gerar planilha" na barra lateral, ou envie uma mensagem para conversar.</div></div>';
  $('msg-inner').appendChild(row);

  var sugs = document.createElement('div');
  sugs.className = 'sug-pills';
  sugs.innerHTML = '<button class="sug-pill" onclick="qs(\'Gerar planilha do arquivo anexado\')">Gerar planilha de etiquetas</button><button class="sug-pill" onclick="qs(\'O que voce pode fazer?\')">O que voce pode fazer?</button>';
  $('msg-inner').appendChild(sugs);
}

function qs(msg) {
  $('chat-inp').value = msg;
  updateSend();
  sendMsg();
}

window.botPlanilha.bot.onProgress(function (payload) {
  if (payload.level === 'debug') return;
  addProcessLog(payload.message, payload.level);
});

window.addEventListener('DOMContentLoaded', function () {
  carregarConversas();
  carregarModelos();
  renderGreeting();
  updateSend();
});
