# Upload real de fatura (leitura de QR no browser)

## Contexto

O MVP hoje só ganha despesas novas através da mutation `ingerirFatura`,
chamada à mão (curl/GraphQL) ou via o ecrã de teste "+ Despesa (teste)" que
fabrica um QR sintético. Não existe nenhum caminho real de "tira uma foto ou
carrega um PDF da fatura" — que é literalmente o objetivo #1 do MVP descrito
no CLAUDE.md ("Ler uma fatura foto ou PDF, extrair os valores..."). Este
trabalho fecha esse caminho: um ecrã onde o utilizador carrega (ou fotografa,
em mobile) uma fatura real, o QR é lido no browser, e a despesa é criada
automaticamente.

Decisões tomadas com o utilizador antes deste desenho:
- **Armazenamento**: disco local no servidor (sem custos, sem credenciais
  externas — o CLAUDE.md previa S3/R2/Supabase, mas isso fica para quando
  houver um destino real de produção).
- **Fallback de visão**: fora de scope — sem chave de API disponível. Se o QR
  não for legível, mostra-se um erro claro; não se finge sucesso.
- **Localização**: novo ecrã "Carregar Fatura" na navegação principal
  (distinto do "+ Despesa (teste)", que se mantém como ferramenta à parte).
- **Mobile**: incluído — o mesmo `<input type="file" capture>` cobre desktop
  e mobile sem trabalho extra.

## Arquitetura

```
<input file> → rasterizar no browser (canvas/pdfjs-dist)
             → jsqr (extrairFatura, já existe em shared/extraction)
             → QR encontrado?
                 sim → upload do ficheiro original (REST, multipart)
                     → ingerirFatura(ficheiroUrl, qrRaw)   [mutation já existe]
                 não → erro explícito, nada é criado
```

A decisão de decodificar o QR no browser (não no servidor) já estava
registada no CLAUDE.md — evita a fragilidade do `pdf.js` em Node (globais de
canvas) e mantém o servidor sem tocar em binários de imagem. O upload do
ficheiro original só acontece **depois** de um QR válido ser encontrado — não
se guardam ficheiros de faturas que não deram para ler.

## Componentes

### Backend — porta `Storage` (novo, mesmo padrão do `Repos`)

- `server/src/storage/types.ts` — `interface Storage { guardar(ficheiro: Buffer, nomeOriginal: string, mime: string): Promise<{ url: string }> }`.
- `server/src/storage/local.ts` — `criarStorageLocal(diretorio: string, baseUrl: string): Storage`. Grava em disco com nome único (`<uuid>-<nomeOriginal>`), devolve `${baseUrl}/<ficheiro>`.
- `server/src/index.ts` — adiciona `multer` para aceitar `multipart/form-data` numa rota REST `POST /upload` (fora do GraphQL — binários não são o forte do GraphQL), mais `express.static` a servir `/files` a partir do diretório de uploads. Precisa de `cors()` também nesta rota (mesmo problema que já resolvemos no `/graphql`).
- `server/uploads/` entra no `.gitignore` (com um `.gitkeep` para o diretório existir no clone).
- Novas dependências: `multer`, `@types/multer`.

### Frontend — adaptadores do browser para `shared/extraction`

`shared/extraction/types.ts` já define `RasterizadorAdapter`/`VisaoAdapter` —
ficam implementados agora pela primeira vez, do lado do browser:

- `web/src/upload/rasterizadorBrowser.ts` — imagens: `createImageBitmap` +
  canvas → `ImageData`. PDFs: `pdfjs-dist` renderiza cada página para canvas
  → `ImageData[]`. Precisa de configurar o `workerSrc` do pdfjs para o Vite
  (import do worker como asset).
- `web/src/upload/visaoIndisponivel.ts` — `VisaoAdapter` cujo
  `extrairDeImagem` rejeita sempre com uma mensagem clara ("A leitura por
  visão ainda não está disponível — tenta uma fatura com QR legível.").

### Frontend — ecrã `CarregarFaturaScreen`

- `web/src/screens/CarregarFaturaScreen.tsx` (+ `.module.css`, `.test.tsx`).
- Aceita os adaptadores como prop opcional (default = os reais do browser) —
  o mesmo truque de injeção já usado em `extrair-fatura.ts`, para os testes
  não dependerem de canvas/pdfjs reais.
- Estados: idle → a processar (mensagem "A ler o QR...") → sucesso
  (mostra dados extraídos + `duplicada`) → erro (mensagem clara, ficheiro
  não é guardado).
- `web/src/graphql.ts` já tem `INGERIR_FATURA` — reutiliza-se sem alterações.
- Nova query REST simples (`fetch` com `FormData`) para o `POST /upload` —
  não passa pelo Apollo Client, que é só para GraphQL.

### Navegação

`AppShell.tsx`: novo item em `NAV_ITEMS` (secção principal, não
"Desenvolvimento") → rota `/carregar-fatura`.

## Tratamento de erros

- QR não encontrado em nenhuma página → erro visível, nenhum upload nem
  `ingerirFatura` acontece.
- Falha no upload do ficheiro (rede, servidor em baixo) → erro visível,
  `ingerirFatura` não chega a ser chamado.
- `ingerirFatura` devolve `duplicada: true` → não é erro, é feedback (mesma
  fatura já lida antes) — mesmo tratamento que o `NovaDespesaTesteScreen` já
  dá a este caso.
- Ficheiro de tipo não suportado (nem imagem nem PDF) → validado no `accept`
  do input e, defensivamente, também antes de rasterizar.

## Testes

- `server/src/storage/local.test.ts` — grava um buffer num diretório
  temporário, confirma que o ficheiro existe no caminho esperado e que o URL
  devolvido está bem formado.
- A rota REST `/upload` **não** ganha teste automático novo — verificação
  manual via curl, consistente com o resto do bootstrap do Express
  (`index.ts` nunca teve testes automáticos neste projeto).
- `CarregarFaturaScreen.test.tsx` — adaptadores injetados como mocks (QR
  encontrado, QR não encontrado, upload falha). Cobre o comportamento do
  ecrã, não a rasterização real.
- **Fora do alcance de testes automáticos**: a rasterização real de
  imagem/PDF no browser (canvas verdadeiro, `pdfjs-dist` verdadeiro) não é
  razoável em jsdom. Fica coberta por verificação manual com uma fatura real
  (foto ou PDF com QR de Portaria 195/2020), não por testes automáticos —
  isto é uma limitação deliberada, não um esquecimento.

## Fora de scope (nesta entrega)

- Fallback de visão (Claude/GPT-4o) — decisão do utilizador, sem chave de API.
- Armazenamento em S3/R2/Supabase — fica para quando houver destino de produção.
- Ingestão por email — já estava fora de scope antes disto.
