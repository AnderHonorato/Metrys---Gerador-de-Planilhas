const https = require('https');

const MODELS = {
  'metrys-flash': {
    name: 'Metrys Flash',
    url: 'https://api.spiderx.com.br/api/ai/deepseek-v4-flash',
    icon: 'flash',
  },
  'metrys-core': {
    name: 'Metrys Core',
    url: 'https://api.spiderx.com.br/api/ai/gemini',
    icon: 'core',
  },
  'metrys-pro': {
    name: 'Metrys Pro',
    url: 'https://api.spiderx.com.br/api/ai/gpt-5-mini',
    icon: 'pro',
  },
};

const SYSTEM_PROMPT = `Voce e o Metrys, uma IA local criada por Anderson Honorato.
REGRA ABSOLUTA: Voce NUNCA deve mencionar ser Gemini, DeepSeek, GPT, OpenAI, Google, SpiderX ou qualquer outro modelo/servico de terceiros.
REGRA ABSOLUTA: Se alguem perguntar "qual modelo voce e", responda: "Sou o Metrys, uma IA local desenvolvida por Anderson Honorato."
REGRA ABSOLUTA: Se alguem perguntar "voce e o Gemini" ou "voce e o GPT" ou "voce e deepseek", responda: "Nao. Eu sou o Metrys, IA independente criada por Anderson Honorato."

Regras adicionais:
- Responda SEMPRE em portugues brasileiro.
- Seja direto, util e objetivo.
- Use seu conhecimento para ajudar com programacao, analise, criacao e pesquisa.
- Para codigo, entregue em blocos markdown com a linguagem correta.
- Nunca invente informacoes. Se nao souber, diga que nao sabe.`;

function buildPrompt(text, history) {
  const parts = [SYSTEM_PROMPT];

  if (history && history.length) {
    const recentHistory = history.slice(-20);
    recentHistory.forEach((msg) => {
      const role = msg.role === 'user' ? 'Usuario' : 'Metrys';
      parts.push(`${role}: ${msg.content}`);
    });
  }

  parts.push(`Usuario: ${text}`);
  parts.push('Metrys:');
  return parts.join('\n\n');
}

function callSpiderX(modelKey, apiKey, text, history) {
  const model = MODELS[modelKey];
  if (!model) return Promise.reject(new Error('Modelo desconhecido: ' + modelKey));

  if (!apiKey || apiKey === 'sua-chave-aqui') {
    return Promise.reject(new Error('Configure a chave de API no arquivo .env (SPIDERX_API_KEY)'));
  }

  const urlObj = new URL(model.url);
  const prompt = buildPrompt(text, history);

  const body = JSON.stringify({ text: prompt });

  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: `${urlObj.pathname}?api_key=${encodeURIComponent(apiKey)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success && parsed.response) {
            resolve({ content: parsed.response, model: model.name });
          } else {
            reject(new Error(parsed.error || parsed.response || 'Resposta inesperada da API'));
          }
        } catch (err) {
          reject(new Error('Falha ao interpretar resposta da API: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error('Erro de conexao: ' + err.message));
    });

    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Timeout na chamada da API'));
    });

    req.write(body);
    req.end();
  });
}

module.exports = { callSpiderX, MODELS };
