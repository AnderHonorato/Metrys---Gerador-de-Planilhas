/**
 * aplicativo.js
 * Logica principal do Metrys Planilhas
 * Integra chat com IA (3 modelos) e bot de geracao de planilhas Excel
 * Desenvolvido por Anderson Honorato - https://anderhonorato.github.io/links
 */

window.onerror = function(msg, url, linha, col, erro) {
  console.error('[ERRO GLOBAL]', msg, 'linha:', linha);
  return false;
};

window.onunhandledrejection = function(e) {
  console.error('[ERRO NÃO TRATADO]', e.reason);
};

// ==================== ESTADO GLOBAL ====================
const estado = {
  arquivos: [],            // arquivos anexados para processar
  processandoPlanilha: false, // indica se a geracao de planilha esta em andamento
  cancelandoPlanilha: false,
  enviandoIA: false,       // indica se a IA esta respondendo uma mensagem
  conversaAtiva: null,     // ID da conversa atual
  modeloAtivo: 'metrys-flash', // modelo de IA selecionado
  ultimoResultado: null,   // resultado da ultima planilha gerada
  pensamentoPlanilha: null,
  pensamentoIA: null,
  inicioProcessamento: null,
  painelAberto: false,     // painel lateral esta visivel?
  abaAtiva: 'atividade',   // aba compartilhada de progresso e pensamento
textosSaudacao: [        // frases que alternam na saudacao
    'Por onde começamos?',
    'O que voce precisa hoje?',
    'Em que posso ajudar?',
    'Vamos criar algo juntos?',
    'Qual e o desafio de hoje?',
    'Pronto para processar etiquetas?',
    'Me diga o que fazer.',
    'Sua IA local a disposicao.',
  ],
  indiceSaudacao: Math.floor(Math.random() * 8),
  frasesPensamento: [
    'Deixe-me pensar...',
    ' processando...',
    ' analisando...',
    ' um momento...',
    ' buscando resposta...',
    ' elaborando...',
    ' pensando...</span> <span class="thinking-dots"></span>',
    ' organizando ideias...',
    ' criando resposta...',
    ' só um instante...',
  ],
  frasesGeracao: [
    'Estou olhando o que voce enviou...',
    'Analisando o conteudo do arquivo...',
    'Pensando na melhor forma de extrair os dados...',
    'Processando pagina por pagina...',
    'Quase na metade, continue comigo...',
    'Montando a planilha com os dados encontrados...',
    'Ajustando a formatacao para ficar bem organizado...',
    'Finalizando, so mais um instante...',
  ],
formatosSelecionados: ['xlsx'],
  modoGeracao: 'separado',
  formatosEscolhidos: false,
  tipoProcessamento: 'geral',
  config: { tema: 'dark', apiKey: '', apisExternas: {} },
  validandoAPI: false,
};

// ==================== UTILITARIOS ====================

/** Atalho para document.getElementById */
function $(id) { return document.getElementById(id); }

/** Escapa texto para insercao segura no HTML */
function escapar(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Retorna hora formatada no padrao brasileiro */
function agora() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function tempoDecorrido() {
  if (!estado.inicioProcessamento) return '';
  var segundos = Math.max(0, Math.round((Date.now() - estado.inicioProcessamento) / 1000));
  if (segundos < 60) return segundos + 's';
  return Math.floor(segundos / 60) + 'min ' + String(segundos % 60).padStart(2, '0') + 's';
}

/** Aguarda N milissegundos */
function aguardar(ms) {
  return new Promise(function (resolver) { setTimeout(resolver, ms); });
}

// ==================== CONTROLES DE JANELA ====================

function minimizar() { window.botPlanilha.janela.minimizar(); }
function maximizar() { window.botPlanilha.janela.maximizar(); }
function fechar() { window.botPlanilha.janela.fechar(); }

// ==================== SIDEBAR ====================

function alternarSidebar() {
  document.getElementById('sidebar').classList.toggle('fechado');
}

// ==================== PAINEL LATERAL DIREITO ====================

function alternarPainel() {
  estado.painelAberto = !estado.painelAberto;
  $('preview-panel').classList.toggle('aberto', estado.painelAberto);
  $('btn-preview').classList.toggle('ativo', estado.painelAberto);
}

function abrirPainel() {
  if (estado.painelAberto) return;
  alternarPainel();
}

function alternarAba(aba) {
  estado.abaAtiva = aba;

  // Atualiza os paineis
  document.querySelectorAll('.ppane').forEach(function (el) { el.classList.remove('ativo'); });
  var pane = $('pane-' + aba);
  if (pane) pane.classList.add('ativo');
  else {
    var paneFallback = $('pane-atividade');
    if (paneFallback) paneFallback.classList.add('ativo');
  }

  // Atualiza as abas visuais
  document.querySelectorAll('.ptab').forEach(function (el) { el.classList.remove('ativo'); });
  var tab = document.querySelector('.ptab[onclick*="\'' + aba + '\'"]');
  if (tab) tab.classList.add('ativo');
}

// ==================== DROPDOWNS ====================

function alternarDrop(id) {
  var dd = document.getElementById(id);
  if (!dd) return;

  // Fecha outros dropdowns
  ['model-dd', 'tools-dd'].forEach(function (outro) {
    if (outro !== id) document.getElementById(outro)?.classList.remove('aberto');
  });

  dd.classList.toggle('aberto');
}

function fecharDrops() {
  ['model-dd', 'tools-dd'].forEach(function (id) {
    document.getElementById(id)?.classList.remove('aberto');
  });
}

// Fecha dropdowns ao clicar fora
document.addEventListener('click', function (evento) {
  if (!evento.target.closest('#model-wrap') && !evento.target.closest('#tools-wrap')) {
    $('model-dd')?.classList.remove('aberto');
    $('tools-dd')?.classList.remove('aberto');
  }
  if (!evento.target.closest('#user-menu-wrap')) {
    $('fm')?.classList.remove('aberto');
  }
});

// ==================== MENU DO USUARIO ====================

function toggleUserMenu() {
  $('fm').classList.toggle('aberto');
}

function abrirLinks() {
  $('fm').classList.remove('aberto');
  window.botPlanilha.arquivos.abrir('https://anderhonorato.github.io/links');
}

// ==================== TEXTAREA ====================

function redimensionar(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
}

function atualizarEnvio() {
  var temArquivos = estado.arquivos.length > 0;
  var temTexto = $('chat-inp').value.trim().length > 0;
  var btn = $('send-btn');
  if (estado.processandoPlanilha) {
    btn.disabled = estado.cancelandoPlanilha;
    btn.classList.add('cancelar');
    btn.title = estado.cancelandoPlanilha ? 'Cancelando...' : 'Cancelar geracao';
    btn.innerHTML = '<span class="stop-square"></span>';
    $('chat-inp').disabled = true;
    $('chat-inp').placeholder = 'Gerando planilha... clique no quadrado para cancelar';
  } else {
    btn.disabled = estado.enviandoIA || (!temTexto && !temArquivos);
    btn.classList.remove('cancelar');
    btn.title = 'Enviar';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    $('chat-inp').disabled = false;
    $('chat-inp').placeholder = 'Mensagem para o Metrys...';
  }
  $('quick-generate').disabled = estado.processandoPlanilha || !temArquivos;
  $('file-count-side').textContent = temArquivos ? estado.arquivos.length + ' arquivo(s)' : 'Nenhum arquivo';
}

function tratarTecla(evento) {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    if (estado.enviandoIA) return;  // Evita duplicar
    enviarMsg();
  }
}

// ==================== STATUS ====================

function definirStatus(texto, classe) {
  $('status-text').textContent = texto;
  var dot = $('status-dot');
  if (dot) {
    dot.style.background = classe === 'ok' ? 'var(--ok)' : classe === 'warn' ? 'var(--warn)' : 'var(--coral)';
  }
}

// ==================== ROLAGEM ====================

function rolarFim() {
  var area = $('msg-area');
  if (area) area.scrollTop = area.scrollHeight;
}

function removerSaudacaoSeInicial() {
  var inner = $('msg-inner');
  if (inner && inner.querySelector('.greeting-row') && inner.children.length === 1) inner.innerHTML = '';
}

function abrirLink(url) {
  window.botPlanilha.arquivos.abrir(url);
}

async function carregarConfiguracoes() {
  try {
    var config = await window.botPlanilha.config.obter();
    estado.config = config || estado.config;
    aplicarTema(estado.config.tema || 'dark');
  } catch (_) {
    aplicarTema('dark');
  }
}

function aplicarTema(tema) {
  var temaFinal = tema === 'light' ? 'light' : 'dark';
  estado.config.tema = temaFinal;
  document.documentElement.setAttribute('data-theme', temaFinal);
}

function abrirConfiguracoes() {
  fecharDrops();
  $('fm').classList.remove('aberto');

  // Abre painel de config sidebar
  $('config-sidebar').classList.add('aberto');

  // Esconde chat e input, mostra conteudo de config
  $('msg-area').style.display = 'none';
  $('input-area').style.display = 'none';
  $('config-conteudo').classList.add('aberto');

  // Carrega valores atuais
  var tema = estado.config.tema || 'dark';
  document.querySelectorAll('input[name="tema-config"]').forEach(function (input) {
    input.checked = input.value === tema;
  });
  $('api-key-spiderx').value = estado.config.apiKey || '';

  var apis = estado.config.apisExternas || {};
  var provedores = ['google', 'deepseek', 'claude', 'gpt'];
  provedores.forEach(function (prov) {
    var chave = apis[prov] ? apis[prov].chave || '' : '';
    var el = $('api-key-' + prov);
    if (el) el.value = chave;

    var statusEl = $('status-api-' + prov);
    if (statusEl) {
      if (apis[prov] && apis[prov].valido) {
        statusEl.textContent = 'Valido';
        statusEl.className = 'api-status ok';
      } else {
        statusEl.textContent = '';
        statusEl.className = 'api-status';
      }
    }
  });

  $('config-status').textContent = '';

  // Seleciona a primeira secao por padrao
  abrirSecaoConfig('tema');
}

function fecharConfiguracoes() {
  $('config-sidebar').classList.remove('aberto');
  $('config-conteudo').classList.remove('aberto');
  $('msg-area').style.display = '';
  $('input-area').style.display = '';
}

function abrirSecaoConfig(secao) {
  // Atualiza os itens da sidebar
  document.querySelectorAll('.config-sidebar-item').forEach(function (item) {
    item.classList.remove('ativo');
  });
  var itemAtivo = document.querySelector('.config-sidebar-item[onclick*="' + secao + '"]');
  if (itemAtivo) itemAtivo.classList.add('ativo');

  // Mostra/oculta as secoes
  var titulos = { tema: 'Aparencia', apis: 'APIs de IA', sobre: 'Sobre' };
  $('config-secao-titulo').textContent = titulos[secao] || secao;

  document.querySelectorAll('.config-secao').forEach(function (el) {
    el.style.display = 'none';
  });
  var secaoEl = $('secao-' + secao);
  if (secaoEl) secaoEl.style.display = '';
}

function alternarVisibilidadeSenha(inputId, btn) {
  var input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.classList.add('ativo');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    input.type = 'password';
    btn.classList.remove('ativo');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

async function validarAPI(provedor) {
  if (estado.validandoAPI) return;
  estado.validandoAPI = true;

  var btn = $('btn-validar-' + provedor);
  var statusEl = $('status-api-' + provedor);
  var inputEl = $('api-key-' + provedor);

  if (btn) {
    btn.textContent = '...';
    btn.classList.add('validando');
    btn.disabled = true;
  }
  if (statusEl) {
    statusEl.textContent = 'Validando...';
    statusEl.className = 'api-status';
  }

  var apiKey = inputEl ? String(inputEl.value || '').trim() : '';
  if (!apiKey) {
    if (statusEl) {
      statusEl.textContent = 'Digite a chave';
      statusEl.className = 'api-status erro';
    }
    estado.validandoAPI = false;
    if (btn) { btn.textContent = 'Validar'; btn.classList.remove('validando'); btn.disabled = false; }
    return;
  }

  try {
    var resultado = await window.botPlanilha.ai.validarAPI(provedor, apiKey);

    if (resultado.ok) {
      // Salva como valido no estado
      if (!estado.config.apisExternas) estado.config.apisExternas = {};
      estado.config.apisExternas[provedor] = { chave: apiKey, valido: true };
      if (statusEl) {
        statusEl.textContent = 'Valido';
        statusEl.className = 'api-status ok';
      }
    } else {
      // Marca como invalido
      if (!estado.config.apisExternas) estado.config.apisExternas = {};
      estado.config.apisExternas[provedor] = { chave: apiKey, valido: false };
      if (statusEl) {
        statusEl.textContent = 'Invalido';
        statusEl.className = 'api-status erro';
        alert(provedor + ': ' + (resultado.erro || 'Falha na validacao'));
      }
    }
  } catch (erro) {
    if (statusEl) {
      statusEl.textContent = 'Erro';
      statusEl.className = 'api-status erro';
    }
  } finally {
    estado.validandoAPI = false;
    if (btn) {
      btn.textContent = 'Validar';
      btn.classList.remove('validando');
      btn.disabled = false;
    }
  }
}

async function salvarConfiguracoes() {
  var temaInput = document.querySelector('input[name="tema-config"]:checked');
  var tema = temaInput ? temaInput.value : 'dark';
  var apiKey = String($('api-key-spiderx').value || '').trim();

  // Mantem as APIs externas ja validadas
  var apis = estado.config.apisExternas || {};
  var provedoresExt = ['google', 'deepseek', 'claude', 'gpt'];
  provedoresExt.forEach(function (prov) {
    var chaveDigitada = String($('api-key-' + prov).value || '').trim();
    if (chaveDigitada) {
      // So salva se ja estava valido ou se a chave mudou (marca como nao valido ate validar)
      if (!apis[prov] || apis[prov].chave !== chaveDigitada) {
        apis[prov] = { chave: chaveDigitada, valido: false };
      }
      // Se a chave for a mesma e ja estava valida, mantem valido
    } else {
      // Se limpou a chave, remove
      delete apis[prov];
    }
  });

  try {
    var config = await window.botPlanilha.config.salvar({ tema: tema, apiKey: apiKey, apisExternas: apis });
    estado.config = config;
    aplicarTema(config.tema);
    carregarModelos();
    $('config-status').textContent = 'Configuracoes salvas.';
    setTimeout(fecharConfiguracoes, 700);
  } catch (erro) {
    $('config-status').textContent = 'Nao consegui salvar: ' + erro.message;
  }
}

function iniciarPensamentoChat(frases, intervalo, corpoInicial) {
  var lista = frases && frases.length ? frases : estado.textosSaudacao;
  var indice = 0;
  var tempo = intervalo || 6500;
  var inicioLocal = Date.now();
  var rotuloTempo = corpoInicial ? 'processou por ' : 'pensou por ';
  var pillExterna = obterPillAPIExterna();
  var linha = document.createElement('div');
  linha.className = 'ia-row thinking-row';
  linha.innerHTML =
    '<div class="ia-avatar-col"><div class="ia-avatar">' + iconeMetrys(28, 'pensando', 't' + Date.now()) + '</div>' + pillExterna + '</div>' +
    '<div class="ia-content">' +
    '<span class="metrys-thinking-text" data-text="' + escapar(lista[0]) + '">' + escapar(lista[0]) + '</span>' +
    (corpoInicial ? '<div class="ia-text thinking-body">' + formatarTexto(corpoInicial) + '</div>' : '') +
    '</div>';
  $('msg-inner').appendChild(linha);
  rolarFim();

  var texto = linha.querySelector('.metrys-thinking-text');
  var timer = setInterval(function () {
    indice = (indice + 1) % lista.length;
    if (texto) {
      texto.textContent = lista[indice];
      texto.setAttribute('data-text', lista[indice]);
    }
  }, tempo);

  return {
    atualizar: function (mensagem) {
      if (!texto || !mensagem) return;
      texto.textContent = mensagem;
      texto.setAttribute('data-text', mensagem);
    },
    encerrar: function (mensagemFinal) {
      clearInterval(timer);
      if (!texto) return;
      texto.textContent = mensagemFinal || 'Concluido.';
      texto.setAttribute('data-text', mensagemFinal || 'Concluido.');
      texto.classList.add('is-done');
    },
finalizarComMensagem: function (mensagem, nivel, htmlExtra) {
      clearInterval(timer);
      var classe = nivel === 'success' ? 'success' : nivel === 'warn' ? 'warn' : nivel === 'error' ? 'error' : '';
      var content = linha.querySelector('.ia-content');
      var avatar = linha.querySelector('.ia-avatar');
      if (!content) return;

      // Calcula tempo gasto
      var temposegundos = Math.max(0, Math.round((Date.now() - inicioLocal) / 1000));

      // Substitui o ícone para parado (mantém estrutura)
      if (avatar) {
        var novoIcone = iconeMetrys(28, 'parado', 'f' + Date.now());
        avatar.innerHTML = novoIcone;
      }

      // Mostra estado "digitando" ENQUANTO digita
      var ThinkingTexto = content.querySelector('.metrys-thinking-text');
      if (ThinkingTexto) {
        ThinkingTexto.textContent = 'Digitando resposta...';
        ThinkingTexto.classList.add('typing');
      }

      // Efeito de digitacao - adiciona APÓS o pensamento
      var textoHtml = formatarTexto(mensagem);
      var iaText = document.createElement('div');
      iaText.className = 'ia-text ' + classe;
      content.appendChild(iaText);

      var i = 0;
      var velocidade = 15;
      var digitTimer = setInterval(function () {
        if (i >= textoHtml.length) {
          clearInterval(digitTimer);
          iaText.innerHTML = textoHtml;

          // Adiciona o HTML extra (card de download, etc) DEPOIS do texto
          if (htmlExtra) {
            var extraDiv = document.createElement('div');
            extraDiv.innerHTML = htmlExtra;
            content.appendChild(extraDiv);
          }

          // SÓ mostra o tempo DEPOIS que terminar de digitar
          if (ThinkingTexto) {
            ThinkingTexto.innerHTML = '<span class="pensamento-tempo" onclick="alternarAba(\'atividade\');abrirPainel()">' + rotuloTempo + temposegundos + 's &gt;</span>';
            ThinkingTexto.classList.remove('typing');
          }
          rolarFim();
          return;
        }
        iaText.innerHTML = textoHtml.slice(0, i + 1);
        i++;
        rolarFim();
      }, velocidade);
    },
    remover: function () {
      clearInterval(timer);
      linha.remove();
    },
  };
}

// ==================== MENSAGENS DO CHAT ====================

function obterPillAPIExterna() {
  var modelo = estado.modeloAtivo;
  if (!modelo) return '';

  var mapaPills = {
    'google-gemini': { classe: 'gemini', texto: 'Gemini' },
    'deepseek': { classe: 'deepseek', texto: 'DeepSeek' },
    'claude': { classe: 'claude', texto: 'Claude' },
    'gpt': { classe: 'gpt', texto: 'ChatGPT' },
  };

  var info = mapaPills[modelo];
  if (!info) return '';

  return '<div class="api-externa-pill ' + info.classe + '" title="Usando API ' + info.texto + '">' + info.texto + '</div>';
}

/**
 * Adiciona mensagem da IA / bot no chat
 */
function adicionarMsgIA(mensagem, nivel, htmlExtra) {
  var linha = document.createElement('div');
  linha.className = 'ia-row';

  var classe = nivel === 'success' ? 'success' : nivel === 'warn' ? 'warn' : nivel === 'error' ? 'error' : '';
  var titulo = 'Metrys Planilhas';

  var pillExterna = obterPillAPIExterna();

  linha.innerHTML =
    '<div class="ia-avatar-col"><div class="ia-avatar">' + iconeMetrys(28, 'parado', 'a' + Date.now()) + '</div>' + pillExterna + '</div>' +
    '<div class="ia-content">' +
    '<div class="ia-text ' + classe + '">' + formatarTexto(mensagem) + '</div>' +
    (htmlExtra || '') +
    '</div>';

  $('msg-inner').appendChild(linha);
  rolarFim();
}

/**
 * Adiciona mensagem do usuario no chat
 */
function adicionarMsgUsuario(mensagem, incluirArquivos) {
  var linha = document.createElement('div');
  linha.className = 'user-row';

  var arquivos = incluirArquivos === false ? '' : estado.arquivos.map(function (f) { return '[anexo] ' + f.nome; }).join('\n');

  linha.innerHTML =
    '<div class="user-bubble">' + escapar(mensagem) + (arquivos ? '\n\n' + escapar(arquivos) : '') + '</div>' +
    '<span class="msg-time">' + agora() + '</span>';

  $('msg-inner').appendChild(linha);
  rolarFim();
}

/**
 * Adiciona mensagem de erro da IA
 */
function adicionarErroIA(mensagem) {
  var linha = document.createElement('div');
  linha.className = 'ia-row';

  var pillExterna = obterPillAPIExterna();

  linha.innerHTML =
    '<div class="ia-avatar-col"><div class="ia-avatar">' + iconeMetrys(28, 'erro', 'e' + Date.now()) + '</div>' + pillExterna + '</div>' +
    '<div class="ia-content">' +
    '<div class="ia-text error">' + formatarTexto(mensagem) + '</div>' +
    '</div>';

  $('msg-inner').appendChild(linha);
  rolarFim();
}

/**
 * Formata texto da IA (markdown simples: negrito, codigo, etc)
 */
var contadorCodigo = 0;

function formatarTexto(texto) {
  contadorCodigo = 0;

  // Primeiro processa blocos de codigo ANTES de escapar o resto
  var partes = [];
  var ultimoFim = 0;
  var regex = /```(\w*)\s*\n?([\s\S]*?)```/g;
  var match;

  while ((match = regex.exec(texto)) !== null) {
    // Texto antes do bloco de codigo
    if (match.index > ultimoFim) {
      partes.push({ tipo: 'texto', conteudo: texto.slice(ultimoFim, match.index) });
    }
    // Bloco de codigo
    partes.push({ tipo: 'codigo', lang: match[1] || 'codigo', conteudo: match[2] });
    ultimoFim = regex.lastIndex;
  }
  // Texto restante
  if (ultimoFim < texto.length) {
    partes.push({ tipo: 'texto', conteudo: texto.slice(ultimoFim) });
  }

  // Monta o HTML
  var html = '';
  partes.forEach(function (parte) {
    if (parte.tipo === 'codigo') {
      contadorCodigo++;
      var codigoLimpo = parte.conteudo.replace(/^\n+|\n+$/g, '');
      var linhas = codigoLimpo.split('\n');
      var colapsar = linhas.length > 20 ? ' colapsado' : '';
      var idCode = 'code-' + Date.now() + '-' + contadorCodigo;
      // Escapa apenas o conteudo do codigo para mostrar tags HTML
      var htmlCode = escapar(codigoLimpo);

      html += '<div class="terminal-code' + colapsar + '" id="' + idCode + '">' +
        '<div class="terminal-topo">' +
        '<span class="terminal-lingua">' + (parte.lang || 'codigo') + '</span>' +
        '<div class="terminal-acoes">' +
        (linhas.length > 20 ? '<button class="terminal-btn" onclick="alternarColapsoCodigo(\'' + idCode + '\')" title="Expandir/Recolher"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>' : '') +
        '<button class="terminal-btn" onclick="copiarCodigo(\'' + idCode + '\')" title="Copiar codigo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
        '<button class="terminal-btn" onclick="abrirCodigoNoPainel(\'' + idCode + '\')" title="Abrir no painel"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></button>' +
        '</div>' +
        '</div>' +
        '<pre><code>' + htmlCode + '</code></pre>' +
        (linhas.length > 20 ? '<div class="terminal-expandir" onclick="alternarColapsoCodigo(\'' + idCode + '\')">Mostrar mais ' + (linhas.length - 15) + ' linhas...</div>' : '') +
        '</div>';
    } else {
      // Texto normal: escapar e aplicar formatacao
      var txt = escapar(parte.conteudo)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>')
        .replace(/(https?:\/\/[^\s<]+)/g, function (url) {
          return '<button class="link-card" onclick="abrirLink(\'' + url.replace(/'/g, '&#39;') + '\')">' + url + '</button>';
        })
        .replace(/\n/g, '<br>');
      html += txt;
    }
  });

  return html;
}

// ==================== ATIVIDADE (PROGRESSO + PENSAMENTO) ====================

function alternarColapsoCodigo(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('colapsado');
}

function copiarCodigo(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var code = el.querySelector('code');
  if (!code) return;
  var texto = code.textContent || '';

  navigator.clipboard.writeText(texto).then(function () {
    var btn = el.querySelector('.terminal-btn[title*="Copiar"]');
    if (btn) {
      var original = btn.innerHTML;
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function () { btn.innerHTML = original; }, 1500);
    }
  }).catch(function () {});
}

function abrirCodigoNoPainel(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var code = el.querySelector('code');
  var lingua = el.querySelector('.terminal-lingua');
  var conteudo = code ? code.textContent : '';
  var nomeLingua = lingua ? lingua.textContent : 'codigo';

  // Garante que existe a aba de codigo e o painel
  if (!$('pane-codigo')) {
    var pane = document.createElement('div');
    pane.className = 'ppane';
    pane.id = 'pane-codigo';
    $('preview-content').appendChild(pane);

    var tab = document.createElement('button');
    tab.className = 'ptab';
    tab.textContent = 'Codigo';
    tab.onclick = function () { alternarAba('codigo'); };
    $('preview-tabs').appendChild(tab);
  }

  var paneCodigo = $('pane-codigo');
  paneCodigo.innerHTML =
    '<div class="terminal-code painel-codigo">' +
    '<div class="terminal-topo">' +
    '<span class="terminal-lingua">' + escapar(nomeLingua) + '</span>' +
    '<div class="terminal-acoes">' +
    '<button class="terminal-btn" onclick="copiarCodigoPainel()" title="Copiar codigo"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
    '</div>' +
    '</div>' +
    '<pre><code>' + escapar(conteudo) + '</code></pre>' +
    '</div>';

  abrirPainel();
  alternarAba('codigo');
}

function copiarCodigoPainel() {
  var pane = $('pane-codigo');
  if (!pane) return;
  var code = pane.querySelector('code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent || '').catch(function () {});
}

function extrairProgressoPagina(mensagem) {
  var match = String(mensagem || '').match(/(?:pagina|página)\s+(\d+)\/(\d+)/i);
  if (!match) return null;
  var atual = Number(match[1]);
  var total = Number(match[2]);
  if (!total) return null;
  return { atual: atual, total: total, porcentagem: Math.min(100, Math.round((atual / total) * 100)) };
}

function frasePensamentoPagina(mensagem) {
  var progresso = extrairProgressoPagina(mensagem);
  if (progresso && /Convertendo pagina/i.test(mensagem)) return 'Convertendo a pagina ' + progresso.atual + ' de ' + progresso.total + ' para imagem... isso pode levar um tempinho.';
  if (progresso && /Executando OCR/i.test(mensagem)) return 'Lendo cada informacao da pagina ' + progresso.atual + ' de ' + progresso.total + '. Identificando dados importantes.';
  if (progresso && /Extraindo campos/i.test(mensagem)) return 'Ja li a pagina ' + progresso.atual + ' de ' + progresso.total + '. Agora separando cada dado no lugar certo.';
  if (progresso && /processada/i.test(mensagem)) return 'Pagina ' + progresso.atual + ' de ' + progresso.total + ' finalizada. Indo para a proxima.';
  return '';
}

function atualizarAtividade(opcoes) {
  var cfg = opcoes || {};
  var log = $('process-log');
  if (!log) return;

  $('atividade-empty').style.display = 'none';
  log.style.display = 'block';

  var nivel = cfg.nivel || 'info';
  var id = String(cfg.id || 'geral').replace(/[^a-zA-Z0-9_-]/g, '-');
  var porcentagem = typeof cfg.porcentagem === 'number' ? Math.max(0, Math.min(100, cfg.porcentagem)) : null;
  var detalhe = cfg.detalhe ? '<div class="atividade-detalhe">' + escapar(cfg.detalhe) + '</div>' : '';
  var barra = porcentagem === null ? '' :
    '<div class="atividade-barra"><span style="width:' + porcentagem + '%"></span></div>' +
    '<div class="atividade-percentual">' + porcentagem + '%</div>';

  var html =
    '<div class="atividade-card ' + nivel + (cfg.animando ? ' animando' : '') + '">' +
    '<div class="atividade-topo">' +
    '<div class="atividade-icone">' + iconeMetrys(34, cfg.animando ? 'pensando' : (nivel === 'error' ? 'erro' : 'parado'), 'p' + Date.now()) + '</div>' +
    '<div class="atividade-cabecalho">' +
    '<strong>' + escapar(cfg.titulo || 'Atividade') + '</strong>' +
    '<span>' + escapar(cfg.mensagem || '') + '</span>' +
    '</div>' +
    '</div>' +
    detalhe + barra +
    '</div>';

  var existente = log.querySelector('[data-atividade-id="' + id + '"]');
  if (!existente) {
    existente = document.createElement('div');
    existente.setAttribute('data-atividade-id', id);
    log.appendChild(existente);
  }
  existente.innerHTML = html;
}

function adicionarLog(payloadOuMensagem, nivelAntigo) {
  var payload = typeof payloadOuMensagem === 'string'
    ? { message: payloadOuMensagem, level: nivelAntigo }
    : (payloadOuMensagem || {});
  var mensagem = payload.message || '';
  var nivel = payload.level || 'info';
  var progresso = extrairProgressoPagina(mensagem);
  var pensamentoPagina = frasePensamentoPagina(mensagem);
  var decorrido = tempoDecorrido();
  var arquivo = payload.fileName || '';

  // Frase padrao mais humana
  var fala = 'Analisando os dados do arquivo...';
  if (/Iniciando processamento/i.test(mensagem)) fala = 'Comecei a processar ' + (estado.arquivos.length || 'os') + ' arquivo(s) que voce enviou.';
  else if (/Arquivo recebido/i.test(mensagem)) fala = 'Recebi ' + (arquivo || 'o arquivo') + '. Estou olhando o conteudo para entender o que tem nele.';
  else if (/Identificando tipo/i.test(mensagem)) fala = 'Identifiquei o tipo do arquivo. Agora vou preparar a extracao dos dados.';
  else if (/PDF detectado/i.test(mensagem)) fala = 'E um PDF. Vou converter cada pagina para conseguir ler o texto.';
  else if (/Convertendo pagina/i.test(mensagem)) fala = 'Convertendo a pagina ' + (progresso ? progresso.atual + ' de ' + progresso.total : '') + ' para imagem... isso pode levar uns segundos.';
  else if (/Executando OCR/i.test(mensagem)) fala = 'Lendo o texto da pagina ' + (progresso ? progresso.atual + ' de ' + progresso.total : '') + ' com OCR. Estou identificando cada informacao.';
  else if (/Extraindo campos/i.test(mensagem)) fala = 'Extraindo os dados da pagina ' + (progresso ? progresso.atual + ' de ' + progresso.total : '') + '. Separando informacoes importantes.';
  else if (/processada/i.test(mensagem)) fala = nivel === 'warn'
    ? 'Terminei a pagina ' + (progresso ? progresso.atual : '') + ', mas nem todos os campos ficaram claros. Vou anotar na auditoria.'
    : 'Pagina ' + (progresso ? progresso.atual + ' de ' + progresso.total : '') + ' concluida. Dados extraidos com sucesso.';
  else if (/Encontrei avisos/i.test(mensagem)) fala = 'Alguns dados do arquivo nao consegui identificar completamente. Deixei anotado na auditoria para voce conferir.';
  else if (/Falha/i.test(mensagem)) fala = 'Tive uma dificuldade nessa parte, mas vou seguir em frente com o que ja consegui extrair.';
  else if (/Gerando planilha/i.test(mensagem)) fala = 'Estou montando a planilha com tudo que encontrei. Colocando cada informacao no lugar certo.';
  else if (/Planilha pronta|Planilha gerada|Arquivos prontos/i.test(mensagem)) fala = nivel === 'warn'
    ? 'Terminei a planilha. Alguns dados ficaram em branco, de uma olhada na auditoria.'
    : 'Pronto! Planilha gerada e pronta para voce baixar.';

  // Se tem progresso de pagina, usa frase especifica
  if (pensamentoPagina && !/Iniciando|Arquivo recebido|Identificando|Gerando|Planilha pronta/i.test(mensagem)) {
    fala = pensamentoPagina;
    if (arquivo) fala = arquivo + ': ' + fala[0].toLowerCase() + fala.slice(1);
  }

  // Atualiza o pensamento no chat
  if (estado.pensamentoPlanilha) {
    if (/Falha|alertas|erro|parcial|avisos/i.test(mensagem)) {
      estado.pensamentoPlanilha.atualizar('Encontrei algo que precisa de atencao em ' + (arquivo || 'um arquivo') + '. Nao se preocupe, vou continuar.');
    } else if (pensamentoPagina || progresso) {
      estado.pensamentoPlanilha.atualizar(fala);
    }
  }

  // Atualiza o card de pensamento na atividade
  atualizarPensamentoAtividade(fala, nivel);

  // Mostra label "Processo" e o log
  $('atividade-empty').style.display = 'none';
  $('atividade-processo-label').style.display = 'block';
  $('process-log').style.display = 'block';

  atualizarAtividade({
    id: arquivo || 'geral',
    titulo: nivel === 'error' ? 'Atencao necessaria' : (arquivo || 'Processando'),
    mensagem: fala,
    nivel: nivel || 'info',
    porcentagem: progresso ? progresso.porcentagem : null,
    detalhe: (decorrido ? decorrido + ' decorridos · ' : '') + (progresso ? 'Pagina ' + progresso.atual + '/' + progresso.total + ' · ' + mensagem : mensagem),
    animando: nivel !== 'success' && nivel !== 'error',
  });
}

function atualizarPensamentoAtividade(frase, nivel) {
  var el = $('atividade-pensamento');
  if (!el || !frase) return;
  el.style.display = 'block';

  var iconeTipo = nivel === 'error' ? 'erro' : nivel === 'warn' ? 'parado' : 'pensando';

  el.innerHTML =
    '<div class="pensamento-card">' +
    '<div class="pensamento-card-icone">' + iconeMetrys(32, iconeTipo, 'tp' + Date.now()) + '</div>' +
    '<div class="pensamento-card-texto">' +
    '<div class="pensamento-card-nome">Metrys pensando...</div>' +
    '<div class="pensamento-card-frase">' + escapar(frase) + '</div>' +
    '</div>' +
    '</div>';
}

function atualizarPensamento(texto) {
  atualizarAtividade({
    titulo: 'Pensamento',
    mensagem: texto,
    nivel: 'info',
    animando: true,
  });
}

// ==================== ARQUIVOS ====================

function renderizarArquivos() {
  var el = $('pending-files');
  el.innerHTML = '';

  estado.arquivos.forEach(function (arquivo, indice) {
    var item = document.createElement('div');
    item.className = 'pfile';
    item.innerHTML =
      '[anexo] ' + escapar(arquivo.nome) +
      ' <button title="Remover" onclick="removerArquivo(' + indice + ')">x</button>';
    el.appendChild(item);
  });

  atualizarEnvio();
}

function abrirModalOpcoes() {
  var modal = $('modal-opcoes-arquivo');
  if (!modal) return;

  modal.classList.add('aberto');
  inicializarOpcoesModal();
}

function fecharModalOpcoes() {
  var modal = $('modal-opcoes-arquivo');
  if (modal) modal.classList.remove('aberto');
}

function inicializarOpcoesModal() {
  var container = $('modal-formato-opcoes');
  if (!container) return;

  container.innerHTML = '';

  window.botPlanilha.bot.formatos().then(function (formatos) {
    formatos.forEach(function (formato) {
      var label = document.createElement('label');
      label.className = 'modal-formato-btn' + (formato.id === 'xlsx' ? ' selecionado' : '');
      label.innerHTML =
        '<input type="checkbox" value="' + formato.id + '"' + (formato.id === 'xlsx' ? ' checked' : '') + ' />' +
        formato.nome;
      label.querySelector('input').addEventListener('change', function () {
        label.classList.toggle('selecionado', this.checked);
      });
      container.appendChild(label);
    });
  });

  var qtd = estado.arquivos.length;
  var modoContainer = $('modal-modo-container');
  if (modoContainer) {
    modoContainer.style.display = qtd > 1 ? 'block' : 'none';
  }

  var tipoGeral = $('tipo-btn-geral');
  var tipoEtiqueta = $('tipo-btn-etiquetas');
  if (tipoGeral && tipoEtiqueta) {
    tipoGeral.classList.add('selecionado');
    tipoEtiqueta.classList.remove('selecionado');
    tipoGeral.querySelector('input').checked = true;
    tipoEtiqueta.querySelector('input').checked = false;
  }

  document.querySelectorAll('.modal-tipo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.modal-tipo-btn').forEach(function (b) { b.classList.remove('selecionado'); });
      this.classList.add('selecionado');
      this.querySelector('input').checked = true;
    });
  });

  document.querySelectorAll('.modal-modo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.modal-modo-btn').forEach(function (b) { b.classList.remove('selecionado'); });
      this.classList.add('selecionado');
      this.querySelector('input').checked = true;
    });
  });
}

function confirmarOpcoes() {
  var formatoBtns = document.querySelectorAll('#modal-formato-opcoes .modal-formato-btn.selecionado input');
  var formatos = [];
  formatoBtns.forEach(function (input) {
    formatos.push(input.value);
  });

  if (!formatos.length) {
    adicionarMsgIA('Selecione pelo menos um formato de saida.', 'warn');
    return;
  }

  var tipoInput = document.querySelector('input[name="tipo-processamento"]:checked');
  var tipo = tipoInput ? tipoInput.value : 'geral';

  var modoInput = document.querySelector('input[name="modo-geracao"]:checked');
  var modo = modoInput ? modoInput.value : 'separado';

  estado.formatosSelecionados = formatos;
  estado.modoGeracao = modo;
  estado.tipoProcessamento = tipo;
  estado.formatosEscolhidos = true;

  fecharModalOpcoes();

  removerSaudacaoSeInicial();
  adicionarMsgUsuario('Gerar planilha (' + tipo + ').', true);
  $('chat-inp').value = '';
  $('chat-inp').style.height = 'auto';
  abrirPainel();
  alternarAba('atividade');
  $('process-log').innerHTML = '';
  $('process-log').style.display = 'block';
  $('atividade-empty').style.display = 'none';
  executarProcessamento();
}

function removerArquivo(indice) {
  if (estado.processandoPlanilha) return;
  estado.arquivos.splice(indice, 1);
  renderizarArquivos();
}

/**
 * Abre seletor de arquivos do sistema
 */
var selecionandoArquivos = false;

async function selecionarArquivos() {
  if (estado.processandoPlanilha || selecionandoArquivos) return;
  selecionandoArquivos = true;
  fecharDrops();

  try {
    var caminhos = await window.botPlanilha.arquivos.selecionar();
    if (!caminhos || !caminhos.length) return;

    var conhecidos = new Set(estado.arquivos.map(function (f) { return f.caminho; }));

    caminhos.forEach(function (caminho) {
      if (!conhecidos.has(caminho)) {
        estado.arquivos.push({ caminho: caminho, nome: caminho.split(/[\\/]/).pop() });
      }
    });

    renderizarArquivos();
    atualizarEnvio();
    estado.formatosEscolhidos = false;

    var arquivosHtml = '<div class="file-chat-card">' + estado.arquivos.map(function (arquivo) {
      return '<div class="file-chat-item"><strong>' + escaping(arquivo.nome) + '</strong><span>Pronto para processamento</span></div>';
    }).join('') + '</div>';

    var ultimaMsg = $('msg-inner').lastElementChild;
    if (ultimaMsg && ultimaMsg.classList.contains('ia-row')) {
      var extra = ultimaMsg.querySelector('.file-chat-card');
      if (extra) {
        extra.outerHTML = arquivosHtml;
        rolarFim();
        abrirModalOpcoes();
        return;
      }
    }

    adicionarMsgIA('Arquivo(s) anexado(s). Escolha o tipo e formato below.', 'info', arquivosHtml);

    abrirModalOpcoes();
  } finally {
    selecionandoArquivos = false;
  }
}

async function perguntarFormato(formatos, qtdArquivos) {
  return new Promise(function (resolver) {
    var html = '<div class="formatos-pergunta">' +
      '<p>Escolha o formato para gerar:</p>' +
      '<div class="formatos-opcoes">' +
      formatos.map(function (f) {
        return '<label class="formato-label"><input type="checkbox" value="' + f.id + '" ' + (f.id === 'xlsx' ? 'checked' : '') + '> ' + f.nome + '</label>';
      }).join('') +
      '</div>';
    if (qtdArquivos > 1) {
      html += '<p class="pergunta-modo">Como gerar?</p>' +
        '<div class="modos-opcoes">' +
        '<label class="modo-label"><input type="radio" name="modo" value="separado" checked> Um arquivo para cada envio</label>' +
        '<label class="modo-label"><input type="radio" name="modo" value="unico"> Tudo em um unico arquivo</label>' +
        '</div>';
    }
    html += '<div class="formatos-botoes">' +
      '<button class="small-btn principal" id="conf-formato-btn">Gerar planilha</button>' +
      '<button class="small-btn" id="cancel-formato-btn">Cancelar</button>' +
      '</div></div>';

    var linha = document.createElement('div');
    linha.className = 'ia-row';
    linha.innerHTML =
      '<div class="ia-avatar-col"><div class="ia-avatar">' + iconeMetrys(28, 'parado', 'f' + Date.now()) + '</div></div>' +
      '<div class="ia-content">' + html + '</div>';

    var inner = $('msg-inner');
    if (inner.querySelector('.greeting-row')) inner.innerHTML = '';
    inner.appendChild(linha);
    rolarFim();

    var formatosEscolhidos = ['xlsx'];
    var modoEscolhido = qtdArquivos > 1 ? 'separado' : 'unico';

    linha.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) formatosEscolhidos.push(this.value);
        else formatosEscolhidos = formatosEscolhidos.filter(function (f) { return f !== this.value; });
      });
    });

    if (qtdArquivos > 1) {
      linha.querySelectorAll('input[type="radio"]').forEach(function (rb) {
        rb.addEventListener('change', function () {
          if (this.checked) modoEscolhido = this.value;
        });
      });
    }

    linha.querySelector('#conf-formato-btn').addEventListener('click', function () {
      linha.remove();
      if (!formatosEscolhidos.length) resolver(null);
      else resolver({ formatos: formatosEscolhidos, modo: modoEscolhido });
    });

    linha.querySelector('#cancel-formato-btn').addEventListener('click', function () {
      linha.remove();
      resolver(null);
    });
  });
}

// ==================== ENVIO DE MENSAGEM ====================

function envioRapido(msg) {
  var inp = $('chat-inp');
  if (inp) { inp.value = msg; atualizarEnvio(); }
  enviarMsg();
}

function gerarPlanilhaRapida() {
  fecharDrops();
  if (!estado.arquivos.length || estado.processandoPlanilha) return;

  abrirModalOpcoes();
}

async function executarProcessamentoComFormato() {
  var opcoesFormato = await window.botPlanilha.bot.formatos();
  var opts = await perguntarFormato(opcoesFormato, estado.arquivos.length);
  if (!opts) return;

  estado.formatosSelecionados = opts.formatos;
  estado.modoGeracao = opts.modo;
  estado.formatosEscolhidos = true;

  abrirPainel();
  alternarAba('atividade');
  $('process-log').innerHTML = '';
  $('process-log').style.display = 'block';
  $('atividade-empty').style.display = 'none';
  removerSaudacaoSeInicial();
  executarProcessamento();
}

/**
 * Funcao principal de envio - decide entre chat com IA ou processamento de arquivo
 */
async function enviarMsg() {
  var mensagem = String($('chat-inp').value || '').trim();

  if (estado.processandoPlanilha) {
    cancelarProcessamento();
    return;
  }

  if (estado.enviandoIA || (!mensagem && (!estado.arquivos.length || estado.processandoPlanilha))) return;

  // Se tem arquivos anexados, processa planilha
  if (estado.arquivos.length > 0) {
    // Se ainda não escolheu formato, abre o modal
    if (!estado.formatosEscolhidos) {
      abrirModalOpcoes();
      return;
    }
    removerSaudacaoSeInicial();
    adicionarMsgUsuario(mensagem || 'Gerar planilha do arquivo anexado.', true);
    $('chat-inp').value = '';
    $('chat-inp').style.height = 'auto';
    abrirPainel();
    alternarAba('atividade');
    $('process-log').innerHTML = '';
    $('process-log').style.display = 'block';
    $('atividade-empty').style.display = 'none';
    executarProcessamento();
    return;
  }

  enviarChatIA(mensagem);
}

async function cancelarProcessamento() {
  if (!estado.processandoPlanilha || estado.cancelandoPlanilha) return;
  estado.cancelandoPlanilha = true;
  atualizarEnvio();
  atualizarAtividade({
    titulo: 'Cancelando planilha',
    mensagem: 'Recebi seu pedido para cancelar. Vou parar assim que a leitura atual permitir.',
    nivel: 'warn',
    animando: true,
  });
  if (estado.pensamentoPlanilha) estado.pensamentoPlanilha.atualizar('Estou cancelando a geracao com seguranca...');
  await window.botPlanilha.bot.cancelar().catch(function () {});
}

async function enviarChatIA(mensagem) {
  if (!mensagem || estado.enviandoIA) return;
  removerSaudacaoSeInicial();

  // Se nao tem conversa ativa, cria uma nova
  if (!estado.conversaAtiva) {
    try {
      var titulo = mensagem.slice(0, 40);
      var conv = await window.botPlanilha.conv.criar(titulo, estado.modeloAtivo);
      estado.conversaAtiva = conv.id;
      $('conv-title').textContent = titulo;
      carregarListaConversas();
    } catch (erro) {
      adicionarMsgIA('Erro ao criar conversa: ' + erro.message, 'error');
      return;
    }
  }

  // Envia a mensagem do usuario para o chat
  var textoUsuario = mensagem;
  adicionarMsgUsuario(textoUsuario, false);
  $('chat-inp').value = '';
  $('chat-inp').style.height = 'auto';
  estado.enviandoIA = true;
  estado.inicioPensamento = Date.now();
  atualizarEnvio();
  definirStatus('Pensando...');
  atualizarPensamento('Processando mensagem com ' + nomeModelo(estado.modeloAtivo) + '...');
  estado.pensamentoIA = iniciarPensamentoChat(estado.frasesPensamento, 3000);

  try {
    abrirPainel();
    alternarAba('atividade');

    var resultado = await window.botPlanilha.ai.enviar(estado.conversaAtiva, estado.modeloAtivo, textoUsuario);
    if (resultado && resultado.ok === false) {
      if (estado.pensamentoIA) estado.pensamentoIA.finalizarComMensagem('Nao consegui responder agora. Tente novamente em instantes.', 'error');
      else adicionarErroIA('Nao consegui responder agora. Tente novamente em instantes.');
      atualizarAtividade({ titulo: 'Falha ao responder', mensagem: 'A conversa continua disponivel, mas a resposta nao chegou neste momento.', nivel: 'error' });
      if (!estado.processandoPlanilha) definirStatus('Erro', 'warn');
      return;
    }
    var raw = resultado.conteudo || resultado.content || '';
    var modelo = resultado.modelo || resultado.model || nomeModelo(estado.modeloAtivo);

console.log('[IA] Raw response:', raw);

    // Separa pensamento e resposta - remove padrão do chat
    var pensamento = '';
    var resposta = raw;
    var matchPensamento = raw.match(/PENSAMENTO:\s*(.+?)\s*\|?\s*RESPOSTA:/is);
    if (matchPensamento && matchPensamento[1]) {
      pensamento = matchPensamento[1].trim();
      resposta = raw.replace(/PENSAMENTO:.+?RESPOSTA:/is, '').trim();
    }
    console.log('[IA] Regex result - Pensamento:', pensamento.slice(0, 30), '| Resposta:', resposta.slice(0, 30));

    // Resposta sem limite de tamanho - a IA responde naturalmente
    // Limpa pensamento da resposta se ainda estiver
    resposta = resposta.replace(/^PENSAMENTO:.*?RESPOSTA:/is, '').trim();

    console.log('[IA] Pensamento:', pensamento.slice(0, 30), '| Resposta:', resposta.slice(0, 30));

    // Espera mais tempo para dar sensação de pensando
    await new Promise(function (r) { setTimeout(r, 2500); });

    // Mostrar pensamento na atividade
    if (pensamento && pensamento.length > 3) {
      console.log('[IA] Digitando pensamento na atividade');
      atualizarAtividade({ titulo: 'Pensando...', mensagem: '_'.repeat(8), nivel: 'info' });
      // Efeito de digitação do pensamento
      var pensamentoHtml = '';
      var p = 0;
      var penTimer = setInterval(function () {
        if (p >= pensamento.length) {
          clearInterval(penTimer);
          atualizarAtividade({ titulo: 'Pensando...', mensagem: pensamento, nivel: 'info' });
          return;
        }
        pensamentoHtml = pensamento.slice(0, p + 1);
        atualizarAtividade({ titulo: 'Pensando...', mensagem: pensamentoHtml + '_', nivel: 'info' });
        p++;
      }, 40);
      await new Promise(function (r) { setTimeout(r, pensamento.length * 40 + 800); });
    }

    // Depois mostra a resposta (mantém pensamento na atividade)
    if (estado.pensamentoIA) estado.pensamentoIA.finalizarComMensagem(resposta || 'Nao consegui montar uma resposta agora. Tente novamente.', resposta ? 'success' : 'warn');
    else adicionarMsgIA(resposta || 'Nao consegui montar uma resposta agora. Tente novamente.', resposta ? 'success' : 'warn');
    atualizarAtividade({ titulo: 'Pensamento', mensagem: pensamento || 'Concluido', nivel: resposta ? 'success' : 'warn' });
    if (!estado.processandoPlanilha) definirStatus('Pronto', 'ok');

    // Atualiza titulo da conversa com a primeira mensagem
    if (estado.conversaAtiva) {
      window.botPlanilha.conv.obter(estado.conversaAtiva).then(function (c) {
        if (c && c.messages) {
          var msgsUsuario = c.messages.filter(function (m) { return m.role === 'user'; });
          if (msgsUsuario.length === 1) {
            $('conv-title').textContent = textoUsuario.slice(0, 50);
            window.botPlanilha.conv.renomear(estado.conversaAtiva, textoUsuario.slice(0, 50)).catch(function () {});
          }
        }
        carregarListaConversas();
      });
    }
  } catch (erro) {
    if (estado.pensamentoIA) estado.pensamentoIA.finalizarComMensagem('Nao consegui responder agora. Tente novamente em instantes.', 'error');
    else adicionarErroIA('Nao consegui responder agora. Tente novamente em instantes.');
    atualizarAtividade({ titulo: 'Falha ao responder', mensagem: 'A conversa continua disponivel, mas a resposta nao chegou neste momento.', nivel: 'error' });
    if (!estado.processandoPlanilha) definirStatus('Erro', 'warn');
  } finally {
    estado.pensamentoIA = null;
    estado.enviandoIA = false;
    atualizarEnvio();
  }
}

// ==================== PROCESSAMENTO DE PLANILHA ====================

async function executarProcessamento() {
  if (!estado.arquivos.length || estado.processandoPlanilha) return;

  var arquivosParaProcessar = estado.arquivos.slice();
  estado.processandoPlanilha = true;
  estado.cancelandoPlanilha = false;
  estado.inicioProcessamento = Date.now();
  definirStatus('Processando...');
  atualizarEnvio();
  atualizarAtividade({ id: 'geral', titulo: 'Gerando planilha', mensagem: 'Preparando tudo para processar seus arquivos.', nivel: 'info', porcentagem: 0, animando: true });
  estado.pensamentoPlanilha = iniciarPensamentoChat(
    estado.frasesGeracao,
    15000,
    'Estou analisando ' + arquivosParaProcessar.length + ' arquivo(s) que voce enviou. Vou extrair todos os dados e montar sua planilha. Acompanhe o progresso ai ao lado.'
  );

  // Registra listener de progresso
  var tratadorProgresso = function (payload) {
    if (payload.level !== 'debug') {
      adicionarLog(payload);
    }
  };
  window.botPlanilha.bot.onProgress(tratadorProgresso);

  try {
    console.log('[DEBUG] iniciando processar com opcoes:', JSON.stringify({ formatos: estado.formatosSelecionados, modo: estado.modoGeracao, tipo: estado.tipoProcessamento }));
    var resultado = await window.botPlanilha.bot.processar(
      arquivosParaProcessar.map(function (f) { return f.caminho; }),
      { formatos: estado.formatosSelecionados, modo: estado.modoGeracao, tipo: estado.tipoProcessamento }
    );
    console.log('[DEBUG] resultado received:', JSON.stringify(resultado).slice(0, 500));

    estado.ultimoResultado = resultado;
    estado.arquivos = [];
    estado.formatosEscolhidos = false;
    renderizarArquivos();

    var nomeResultado = resultado.fileName || (resultado.arquivosOutput && resultado.arquivosOutput.length ? resultado.arquivosOutput.length + ' arquivo(s) gerado(s)' : 'Arquivos gerados');
    adicionarLog({ message: 'Planilha gerada: ' + nomeResultado, level: 'success' });
    atualizarAtividade({
      titulo: resultado.statusFinal === 'ok' ? 'Planilha pronta' : 'Planilha pronta com avisos',
      mensagem: nomeResultado,
      detalhe: resultado.totalPaginas + ' pagina(s) processada(s), ' + resultado.totalRegistros + ' registro(s) extraido(s).',
      nivel: resultado.statusFinal === 'ok' ? 'success' : 'warn',
      porcentagem: 100,
    });

    // Atualiza o pensamento final
    atualizarPensamentoAtividade(
      resultado.statusFinal === 'ok'
        ? 'Tudo certo! Sua planilha ficou pronta. ' + resultado.totalRegistros + ' dados organizados em ' + resultado.duracaoSegundos + 's.'
        : 'Terminei! Mas tive dificuldade com alguns dados. De uma olhada na auditoria.',
      resultado.statusFinal === 'ok' ? 'success' : 'warn'
    );

    // Monta card de download
    var extra =
      '<div class="download-card">' +
      '<div class="download-info">' +
      '<strong>' + escapar(nomeResultado) + '</strong>' +
      '<div class="result-chips">' +
      '<span>' + resultado.totalArquivos + ' arquivo(s)</span>' +
      '<span>' + resultado.totalPaginas + ' pagina(s)</span>' +
      '<span>' + resultado.totalRegistros + ' registro(s)</span>' +
      '<span>' + resultado.duracaoSegundos + 's</span>' +
      '</div>' +
      '</div>' +
      '<div class="download-actions">' +
      '<button class="small-btn principal" onclick="abrirPlanilha()">Baixar planilha</button>' +
      '<button class="small-btn" onclick="mostrarPastaPlanilha()">Mostrar pasta</button>' +
      '</div>' +
      '</div>';

    var statusTexto = resultado.statusFinal === 'ok' ? 'success' : 'warn';
    var avisoTexto = resultado.avisos && resultado.avisos.length
      ? ' Aviso: ' + resultado.avisos.slice(0, 2).join(' | ')
      : '';
    var mensagemFinal = 'Terminei! Processei ' + resultado.totalPaginas +
      ' pagina(s) e extrai ' + resultado.totalRegistros + ' registro(s) em ' + resultado.duracaoSegundos + ' segundos. ' +
      (resultado.statusFinal === 'ok' ? 'Todos os dados foram identificados. Sua planilha esta pronta abaixo.' : 'Alguns dados nao ficaram 100% claros. De uma olhada na auditoria para conferir.' + avisoTexto);
    if (estado.pensamentoPlanilha) estado.pensamentoPlanilha.finalizarComMensagem(mensagemFinal, statusTexto, extra);
    else adicionarMsgIA(mensagemFinal, statusTexto, extra);

    definirStatus(resultado.statusFinal === 'ok' ? 'Concluido' : 'Concluido com alerta',
      resultado.statusFinal === 'ok' ? 'ok' : 'warn');
  } catch (erro) {
    console.log('[DEBUG] ERRO no processar:', erro);
    var cancelado = erro && /cancelado/i.test(erro.message || '');
    var msgErro = cancelado
      ? 'Geração cancelada. Nenhum arquivo final foi criado desta vez.'
      : 'Nao consegui finalizar a planilha. Se eu consegui ler alguma parte, ela foi preservada nos avisos do processamento.';
    if (estado.pensamentoPlanilha) estado.pensamentoPlanilha.finalizarComMensagem(msgErro, cancelado ? 'warn' : 'error');
    else adicionarMsgIA(msgErro, cancelado ? 'warn' : 'error');
    atualizarAtividade({
      titulo: cancelado ? 'Geracao cancelada' : 'Falha na planilha',
      mensagem: cancelado ? 'Parei a geracao como voce pediu.' : 'Encontrei um problema ao fechar o arquivo. A conversa continua disponivel.',
      detalhe: cancelado ? 'Voce pode anexar outro arquivo ou tentar gerar novamente.' : 'Tente novamente com uma imagem/PDF mais legivel ou envie outro formato.',
      nivel: cancelado ? 'warn' : 'error',
    });
    definirStatus(cancelado ? 'Cancelado' : 'Erro', 'warn');
  } finally {
    estado.pensamentoPlanilha = null;
    estado.processandoPlanilha = false;
    estado.cancelandoPlanilha = false;
    estado.inicioProcessamento = null;
    atualizarEnvio();
    window.botPlanilha.bot.removeProgressListener(tratadorProgresso);
  }
}

function abrirPlanilha() {
  var caminho = obterPrimeiroArquivoResultado();
  if (caminho) window.botPlanilha.arquivos.abrir(caminho);
}

function mostrarPastaPlanilha() {
  var caminho = obterPrimeiroArquivoResultado();
  if (caminho) window.botPlanilha.arquivos.mostrarNaPasta(caminho);
}

function obterPrimeiroArquivoResultado() {
  if (!estado.ultimoResultado) return '';
  if (estado.ultimoResultado.outputPath) return estado.ultimoResultado.outputPath;
  var grupo = estado.ultimoResultado.arquivosOutput && estado.ultimoResultado.arquivosOutput[0];
  if (!grupo) return '';
  var paths = grupo.paths;
  if (!paths || !paths.length) return '';
  var primeiro = paths[0];
  if (!primeiro) return '';
  if (typeof primeiro === 'string') return primeiro;
  return primeiro.path || '';
}

// ==================== CONVERSAS ====================

async function novaConversa() {
  if (estado.enviandoIA || estado.processandoPlanilha) return;

  try {
    var conv = await window.botPlanilha.conv.criar('Nova conversa', estado.modeloAtivo);
    carregarConversa(conv.id);
  } catch (erro) {
    adicionarMsgIA('Erro ao criar conversa: ' + erro.message, 'error');
  }
}

/**
 * Carrega uma conversa existente e exibe suas mensagens
 */
async function carregarConversa(id) {
  estado.conversaAtiva = id;
  estado.arquivos = [];
  estado.formatosEscolhidos = false;
  estado.ultimoResultado = null;
  $('msg-inner').innerHTML = '';
  $('chat-inp').value = '';
  renderizarArquivos();

  try {
    var conv = await window.botPlanilha.conv.obter(id);
    if (!conv) { renderizarSaudacao(); return; }

    $('conv-title').textContent = conv.title || 'Conversa';
    estado.modeloAtivo = conv.model || 'metrys-pro';
    $('model-lbl').textContent = nomeModelo(conv.model);

    if (conv.messages && conv.messages.length) {
      conv.messages.forEach(function (msg) {
        if (msg.role === 'user') {
          adicionarMsgUsuario(msg.content, false);
        } else if (msg.error) {
          adicionarErroIA(msg.content);
        } else {
          adicionarMsgIA(msg.content);
        }
      });
    }
  } catch (erro) {
    renderizarSaudacao();
  }

  carregarListaConversas();
}

/**
 * Carrega e renderiza a lista de conversas na sidebar
 */
async function carregarListaConversas() {
  try {
    var lista = await window.botPlanilha.conv.listar();
    var el = $('conv-list');
    el.innerHTML = '';

    lista.forEach(function (conv, indice) {
      var item = document.createElement('div');
      item.className = 'conv-item' + (conv.id === estado.conversaAtiva ? ' ativo' : '');
      item.style.animationDelay = (indice * 0.04) + 's';
      item.innerHTML =
        '<span class="conv-name">' + escapar(conv.title || 'Conversa') + '</span>' +
        '<button class="conv-del" title="Excluir" onclick="event.stopPropagation();excluirConversa(\'' + conv.id + '\')">✕</button>';
      item.onclick = function () { carregarConversa(conv.id); };
      el.appendChild(item);
    });
  } catch (erro) {
    // Silencioso - sem conversas
  }
}

/**
 * Exclui uma conversa
 */
async function excluirConversa(id) {
  if (estado.enviandoIA || estado.processandoPlanilha) return;

  await window.botPlanilha.conv.excluir(id);

  if (estado.conversaAtiva === id) {
    estado.conversaAtiva = null;
    $('msg-inner').innerHTML = '';
    $('conv-title').textContent = 'Nova conversa';
    renderizarSaudacao();
  }

  carregarListaConversas();
}

// ==================== MODELOS DE IA ====================

/** Mapeia ID do modelo para nome exibido */
function nomeModelo(id) {
  var mapa = {
    'metrys-flash': 'Metrys Flash',
    'metrys-core': 'Metrys Core',
    'metrys-pro': 'Metrys Pro',
  };
  return mapa[id] || 'Metrys';
}

/**
 * Carrega a lista de modelos disponiveis no dropdown
 */
async function carregarModelos() {
  try {
    var modelos = await window.botPlanilha.ai.modelos();
    var dd = $('model-dd');
    dd.innerHTML = '';

    modelos.forEach(function (modelo) {
      var item = document.createElement('div');
      item.className = 'drop-item' + (modelo.id === estado.modeloAtivo ? ' ativo' : '');
      item.innerHTML = '<div class="drop-item-dot" style="background:var(--coral)"></div>' + modelo.name;
      item.onclick = function () {
        estado.modeloAtivo = modelo.id;
        $('model-lbl').textContent = modelo.name;
        $('model-dd').classList.remove('aberto');
        document.querySelectorAll('#model-dd .drop-item').forEach(function (el) { el.classList.remove('ativo'); });
        item.classList.add('ativo');
      };
      dd.appendChild(item);
    });
  } catch (erro) {
    var dd = $('model-dd');
    dd.innerHTML = '<div class="drop-item ativo"><div class="drop-item-dot" style="background:var(--coral)"></div>Erro ao carregar modelos</div>';
  }
}

// ==================== SAUDACAO INICIAL ====================

/**
 * Renderiza a tela de saudacao com icone e sugestoes
 */
function renderizarSaudacao() {
  var inner = $('msg-inner');
  inner.innerHTML = '';

  // Linha da saudacao
  var linha = document.createElement('div');
  linha.className = 'ia-row greeting-row';

  var nomeUsuario = 'Anderson';
  var texto = estado.textosSaudacao[estado.indiceSaudacao];

  linha.innerHTML =
    '<div class="ia-avatar-col">' +
    '<div class="ia-avatar ia-avatar-big">' + iconeMetrys(74, 'parado', 'g' + Date.now()) + '</div>' +
    '</div>' +
    '<div class="ia-content greeting-content">' +
    '<div class="greeting-hello">Ola, ' + nomeUsuario + '</div>' +
    '<div class="greeting-sub">' + texto + '</div>' +
    '<div class="sug-pills" id="sug-pills-wrap">' +
    '<button class="sug-pill" onclick="envioRapido(\'O que voce pode fazer?\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> O que voce pode fazer?</button>' +
    '<button class="sug-pill" onclick="envioRapido(\'Quem e seu criador?\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> Quem e seu criador?</button>' +
    '<button class="sug-pill" onclick="envioRapido(\'Gerar planilha do arquivo anexado\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Gerar planilha de etiquetas</button>' +
    '</div>' +
    '</div>';

  inner.appendChild(linha);

  // Rotaciona saudacao periodicamente
  setTimeout(function () {
    estado.indiceSaudacao = (estado.indiceSaudacao + 1) % estado.textosSaudacao.length;
    var subEl = document.getElementById('greet-sub');
    if (subEl) subEl.textContent = estado.textosSaudacao[estado.indiceSaudacao];
  }, 120000);
}

// ==================== INICIALIZACAO ====================

/**
 * Inicializa o aplicativo quando a pagina carrega
 */
async function inicializar() {
  await carregarConfiguracoes();
  carregarListaConversas();
  carregarModelos();
  renderizarSaudacao();
  atualizarEnvio();
}

window.addEventListener('DOMContentLoaded', inicializar);
