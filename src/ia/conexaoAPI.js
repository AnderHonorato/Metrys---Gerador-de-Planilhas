const { fetch: nodeFetch } = globalThis;

// Modelos padrao do Metrys (usam a API SpiderX)
const MODELOS_PADRAO = {
  'metrys-flash': {
    nome: 'Metrys Flash',
    url: 'https://api.spiderx.com.br/api/ai/deepseek-v4-flash',
    icone: 'flash',
    provedor: 'spiderx',
  },
  'metrys-core': {
    nome: 'Metrys Core',
    url: 'https://api.spiderx.com.br/api/ai/gemini',
    icone: 'core',
    provedor: 'spiderx',
  },
  'metrys-pro': {
    nome: 'Metrys Pro',
    url: 'https://api.spiderx.com.br/api/ai/gpt-5-mini',
    icone: 'pro',
    provedor: 'spiderx',
  },
};

// Modelos externos que o usuario pode adicionar com sua propria API key
const MODELOS_EXTERNOS = {
  'google-gemini': {
    nome: 'Google Gemini',
    provedor: 'google',
    urlValidacao: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    urlChat: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    icone: 'gemini',
  },
  'deepseek': {
    nome: 'DeepSeek',
    provedor: 'deepseek',
    urlValidacao: 'https://api.deepseek.com/v1/models',
    urlChat: 'https://api.deepseek.com/v1/chat/completions',
    icone: 'deepseek',
  },
  'claude': {
    nome: 'Claude (Anthropic)',
    provedor: 'anthropic',
    urlValidacao: 'https://api.anthropic.com/v1/messages',
    urlChat: 'https://api.anthropic.com/v1/messages',
    icone: 'claude',
  },
  'gpt': {
    nome: 'ChatGPT (OpenAI)',
    provedor: 'openai',
    urlValidacao: 'https://api.openai.com/v1/models',
    urlChat: 'https://api.openai.com/v1/chat/completions',
    icone: 'gpt',
  },
};

// Junta tudo - os padrao sempre disponiveis
function getMODELOS(chavesExternas) {
  const modelos = { ...MODELOS_PADRAO };

  if (chavesExternas) {
    Object.keys(MODELOS_EXTERNOS).forEach(function (chave) {
      if (chavesExternas[chave] && chavesExternas[chave].valido) {
        modelos[chave] = {
          ...MODELOS_EXTERNOS[chave],
          apiKey: chavesExternas[chave].chave,
        };
      }
    });
  }

  return modelos;
}

/**
 * Constroi o prompt combinando sistema + historico + mensagem do usuario
 */
const MAX_CHARS = 4000;

function montarPrompt(texto, historico) {
  var sistema = 'Voce e o Metrys, criado por Anderson Honorato. Responda em pt-BR de forma natural e direta, adaptando o tamanho da resposta a pergunta. Seja util e objetivo. Para codigos use ```linguagem.';

  var partes = [sistema];
  var restante = MAX_CHARS - sistema.length - 50;

  if (historico && historico.length >= 2) {
    var ult = historico[historico.length - 1];
    if (ult && ult.content) {
      var txt = (ult.role === 'user' ? 'U' : 'M') + ': ' + ult.content.slice(0, 80);
      if (txt.length < restante) {
        partes.push(txt);
        restante -= txt.length + 2;
      }
    }
  }

  var textoUsuario = 'U: ' + texto.slice(0, 300);
  partes.push(textoUsuario);
  partes.push('M: Responda: PENSAMENTO: [1 linha] | RESPOSTA: [resposta]');

  return partes.join('\n\n').slice(0, MAX_CHARS - 50);
}

/**
 * Faz a chamada HTTP para a API, tratando erros com mensagens amigaveis
 */
async function chamarAPI(chaveModelo, chaveAPI, texto, historico, chavesExternas) {
  const todosModelos = getMODELOS(chavesExternas);
  const modelo = todosModelos[chaveModelo];
  if (!modelo) throw new Error('Modelo nao encontrado.');

  // Se for modelo externo, usa sua propria chave
  if (modelo.provedor && modelo.provedor !== 'spiderx') {
    return chamarAPIExterna(modelo, texto, historico);
  }

  // Modelos padrao SpiderX
  if (!chaveAPI || chaveAPI === 'sua-chave-aqui' || chaveAPI.length < 5) {
    throw new Error('Chave de API nao configurada. Configure nas configuracoes.');
  }

  const urlBase = modelo.url + '?api_key=' + encodeURIComponent(chaveAPI);
  const prompt = montarPrompt(texto, historico);
  const corpoReq = JSON.stringify({ text: prompt });

  try {
    const res = await nodeFetch(urlBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: corpoReq,
    });

    const dados = await res.text();
    const obj = JSON.parse(dados);

    if (obj.success && obj.response) {
      return { conteudo: obj.response, modelo: modelo.nome };
    } else if (obj.response) {
      return { conteudo: obj.response, modelo: modelo.nome };
    } else {
      console.error('[IA] JSON sem resposta esperada', { modelo: modelo.nome, statusCode: res.status, bodyPreview: dados.slice(0, 800) });
      throw new Error('Nao foi possivel obter resposta no momento. Tente novamente.');
    }
  } catch (err) {
    if (err.message.includes('Nao foi possivel') || err.message.includes('Modelo')) throw err;
    console.error('[IA] Falha de conexao', { modelo: modelo.nome, mensagem: err && err.message });
    throw new Error('Falha na conexao. Verifique sua internet e tente novamente.');
  }
}

async function chamarAPIExterna(modelo, texto, historico) {
  const provedor = modelo.provedor;
  const apiKey = modelo.apiKey;
  const nomeModelo = modelo.nome;

  if (!apiKey) throw new Error('Chave de API nao configurada para ' + nomeModelo);

  // Prompt natural com resumo do historico para contexto
  var sistema = 'Voce esta integrado ao app Metrys Planilhas (criado por Anderson Honorato). ';
  sistema += 'Responda em pt-BR de forma natural e direta, adaptando o tamanho da resposta a pergunta. ';
  sistema += 'Se perguntarem quem te criou, responda com a verdade sobre seu provedor (' + nomeModelo + '). ';
  sistema += 'Para codigos, use blocos ```linguagem. Nao use emojis em excesso. ';

  // Inclui resumo do historico da conversa para contexto
  if (historico && historico.length) {
    var ultimas = historico.slice(-6);
    sistema += 'Historico recente da conversa:\n';
    ultimas.forEach(function (m) {
      sistema += (m.role === 'user' ? 'Usuario' : 'Assistente') + ': ' + m.content.slice(0, 200) + '\n';
    });
  }

  if (provedor === 'openai' || provedor === 'deepseek') {
    const mensagens = [{ role: 'system', content: sistema }];
    if (historico && historico.length) {
      historico.slice(-10).forEach(function (m) {
        mensagens.push({ role: m.role, content: m.content });
      });
    }
    mensagens.push({ role: 'user', content: texto });

    const res = await nodeFetch(modelo.urlChat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({ model: provedor === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini', messages: mensagens }),
    });

    const dados = await res.json();
    if (dados.error) throw new Error(dados.error.message || 'Erro na API ' + modelo.nome);
    const conteudo = dados.choices && dados.choices[0] && dados.choices[0].message && dados.choices[0].message.content;
    return { conteudo: conteudo || 'Sem resposta.', modelo: modelo.nome };
  }

  if (provedor === 'google') {
    var promptGoogle = sistema + '\n\nMensagem do usuario: ' + texto;
    const res = await nodeFetch(modelo.urlChat + '?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptGoogle }] }] }),
    });

    const dados = await res.json();
    if (dados.error) throw new Error(dados.error.message || 'Erro na API ' + modelo.nome);
    const conteudo = dados.candidates && dados.candidates[0] && dados.candidates[0].content && dados.candidates[0].content.parts && dados.candidates[0].content.parts[0] && dados.candidates[0].content.parts[0].text;
    return { conteudo: conteudo || 'Sem resposta.', modelo: modelo.nome };
  }

  if (provedor === 'anthropic') {
    const mensagens = [];
    if (historico && historico.length) {
      historico.slice(-10).forEach(function (m) {
        mensagens.push({ role: m.role, content: m.content });
      });
    }
    mensagens.push({ role: 'user', content: texto });

    const res = await nodeFetch(modelo.urlChat, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 4096, system: sistema, messages: mensagens }),
    });

    const dados = await res.json();
    if (dados.error) throw new Error(dados.error.message || 'Erro na API ' + modelo.nome);
    const conteudo = dados.content && dados.content[0] && dados.content[0].text;
    return { conteudo: conteudo || 'Sem resposta.', modelo: modelo.nome };
  }

  throw new Error('Provedor nao suportado: ' + provedor);
}

/**
 * Valida se uma chave de API externa esta funcionando
 * Retorna { ok: true } ou { ok: false, erro: 'mensagem' }
 */
async function validarAPIExterna(provedor, apiKey) {
  const modelo = MODELOS_EXTERNOS[provedor];
  if (!modelo) return { ok: false, erro: 'Provedor desconhecido: ' + provedor };

  try {
    if (provedor === 'openai') {
      const res = await nodeFetch(modelo.urlValidacao, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
      });
      if (res.status === 200 || res.status === 401) {
        const dados = await res.json();
        if (dados.data) return { ok: true };
        return { ok: false, erro: 'Chave OpenAI invalida. Verifique e tente novamente.' };
      }
      return { ok: false, erro: 'Erro ao conectar na OpenAI (status ' + res.status + ').' };
    }

    if (provedor === 'deepseek') {
      const res = await nodeFetch(modelo.urlValidacao, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + apiKey },
      });
      if (res.status === 200) {
        const dados = await res.json();
        if (dados.data) return { ok: true };
        return { ok: false, erro: 'Chave DeepSeek invalida.' };
      }
      return { ok: false, erro: 'Erro ao conectar na DeepSeek (status ' + res.status + ').' };
    }

    if (provedor === 'google') {
      const res = await nodeFetch(modelo.urlValidacao + '?key=' + encodeURIComponent(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'oi' }] }] }),
      });
      if (res.status === 200) return { ok: true };
      const dados = await res.json();
      return { ok: false, erro: 'Chave Google Gemini invalida: ' + (dados.error && dados.error.message || 'status ' + res.status) };
    }

    if (provedor === 'anthropic') {
      const res = await nodeFetch(modelo.urlValidacao, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 10, messages: [{ role: 'user', content: 'oi' }] }),
      });
      if (res.status === 200) return { ok: true };
      const dados = await res.json();
      return { ok: false, erro: 'Chave Claude invalida: ' + (dados.error && dados.error.message || 'status ' + res.status) };
    }

    return { ok: false, erro: 'Provedor nao implementado para validacao.' };
  } catch (err) {
    return { ok: false, erro: 'Falha na conexao: ' + (err && err.message || 'Erro desconhecido') };
  }
}

module.exports = { chamarAPI, validarAPIExterna, getMODELOS, MODELOS_PADRAO, MODELOS_EXTERNOS };