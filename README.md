# Metrys Planilhas

Bot local com chat IA + gerador de planilhas Excel a partir de PDFs e imagens de etiquetas.

Desenvolvido por Anderson Honorato - https://anderhonorato.github.io/links

---

## Funcionalidades

### Chat com IA
- 3 modelos de IA disponiveis via API: Metrys Flash, Metrys Core, Metrys Pro
- Nunca revela o nome real do modelo ou do provedor
- Pergunte "quem e seu criador?" e a IA respondera com meus links
- Criacao de multiplas conversas com historico salvo localmente

### Bot de Planilhas
- Recebe PDF, PNG, JPG, JPEG, ZPL, EPL, TSPL, PRN, LBL, TXT, CSV, XLSX
- Converte PDFs usando `pdfjs-dist`
- OCR local com `tesseract.js` (portugues + ingles)
- Pre-processamento de imagem com `sharp`
- Extrai dados de etiquetas por regras (regex/coordenadas)
- Detecta automaticamente Mercado Livre vs Shopee
- Gera planilha com abas Etiquetas e Auditoria
- Nao usa IA generativa para extracao - e tudo deterministico

---

## Instalacao

```bash
npm install
```

## Uso

```bash
npm start
```

## Verificacao

```bash
npm run check
```

## Configuracao da API (chat IA)

Edite o arquivo `.env` na raiz do projeto:

```env
SPIDERX_API_KEY=sua-chave-aqui
```

Substitua `sua-chave-aqui` pela sua chave de API.

Sem a chave, o chat com IA nao funcionara, mas o bot de planilhas funciona normalmente.

---

## Estrutura do projeto

```
├── main.js              # Processo principal do Electron
├── preload.js           # Ponte IPC segura
├── index.html           # Interface do chat
├── estilos.css          # Tema escuro Metrys
├── package.json
├── .env                 # Chave de API (nao commitar)
├── js/
│   └── aplicativo.js    # Logica do chat e interface
├── src/
│   ├── bot/             # Bot de processamento de planilhas
│   │   ├── index.js           # Orquestrador do processamento
│   │   ├── pdf/pdfRenderer.js # Renderizacao PDF -> PNG
│   │   ├── ocr/ocrService.js  # OCR local com Tesseract
│   │   ├── ocr/imagePreprocess.js # Melhoria de imagem
│   │   ├── extractors/        # Extratores por tipo de etiqueta
│   │   ├── excel/excelBuilder.js # Gerador de planilha XLSX
│   │   ├── audit/auditService.js # Auditoria e validacao
│   │   ├── constants.js       # Colunas e definicoes
│   │   └── utils/             # Normalizacao e regex
│   └── ia/
│       └── conexaoAPI.js      # Cliente HTTP para API de IA
├── scripts/
│   └── self-check.js          # Verificador de dependencias
├── saida/                     # Planilhas geradas
└── Exemplos (apenas visualizacao)/
    ├── PDF para testes ML.pdf
    ├── PDF para testes Xhopee.pdf
    └── Planilha exemplo.xlsx
```
