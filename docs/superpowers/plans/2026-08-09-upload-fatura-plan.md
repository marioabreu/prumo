# Upload real de fatura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um ecrã real onde o utilizador carrega (ou fotografa, em mobile)
uma fatura, o QR é lido no browser, e a despesa é criada automaticamente via
`ingerirFatura` — fecha o objetivo #1 do MVP descrito no CLAUDE.md.

**Architecture:** O browser rasteriza o ficheiro (canvas para imagem,
`pdfjs-dist` para PDF) e corre `extrairFatura`/`jsqr` — já existentes e
testados em `shared/extraction` — inteiramente no cliente. Só depois de um
QR válido ser encontrado é que o ficheiro original sobe para uma nova rota
REST no servidor (`POST /upload`, fora do GraphQL) que o grava em disco
local através de uma nova porta `Storage`, e a despesa é criada pela mutation
`ingerirFatura` já existente, sem alterações.

**Tech Stack:** Reutiliza tudo o que já existe (Express, Apollo, React,
`shared/extraction`). Novidades: `multer` (upload multipart no servidor),
`pdfjs-dist` usado agora também do lado do browser (já é dependência do
`shared`).

## Global Constraints

- Decode do QR acontece sempre no browser — nunca no servidor (CLAUDE.md,
  risco "pdf.js em Node é fiddly").
- Ficheiro original só é gravado **depois** de um QR válido ser encontrado —
  nunca se guardam faturas ilegíveis.
- Sem fallback de visão nesta entrega — erro claro quando não há QR legível,
  nunca se finge sucesso.
- Armazenamento é disco local (`server/uploads/`) atrás de uma porta
  `Storage`, para poder trocar por S3/R2 mais tarde sem tocar nos
  consumidores.
- `npm test`/`npm run build` na raiz têm de continuar limpos depois de cada
  task.

---

## File Structure

```
server/
├─ .gitignore                          # + /uploads (mantém .gitkeep)
├─ uploads/.gitkeep
├─ package.json                        # + multer, @types/multer
└─ src/
   ├─ storage/
   │  ├─ types.ts                      # porta Storage
   │  ├─ local.ts                      # criarStorageLocal
   │  └─ local.test.ts
   └─ index.ts                         # + rota POST /upload, /files estático

web/
├─ package.json                        # + pdfjs-dist explícito
└─ src/
   ├─ upload/
   │  ├─ rasterizadorBrowser.ts        # RasterizadorAdapter real (canvas/pdfjs)
   │  └─ visaoIndisponivel.ts          # VisaoAdapter que rejeita sempre
   ├─ screens/
   │  ├─ CarregarFaturaScreen.tsx
   │  ├─ CarregarFaturaScreen.module.css
   │  └─ CarregarFaturaScreen.test.tsx
   ├─ ui/AppShell.tsx                  # + item de nav "Carregar Fatura"
   └─ App.tsx                          # + rota /carregar-fatura
```

---

### Task 1: Porta `Storage` + implementação local + testes

**Files:**
- Create: `server/src/storage/types.ts`
- Create: `server/src/storage/local.ts`
- Test: `server/src/storage/local.test.ts`

**Interfaces:**
- Produces: `criarStorageLocal(diretorio: string, baseUrl: string): Storage`,
  usada por `server/src/index.ts` na Task 2.

- [ ] **Step 1: Definir a porta em `server/src/storage/types.ts`**

```ts
export interface Storage {
  guardar(ficheiro: Buffer, nomeOriginal: string, mime: string): Promise<{ url: string }>;
}
```

- [ ] **Step 2: Escrever `server/src/storage/local.test.ts` primeiro**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { criarStorageLocal } from "./local.js";

describe("criarStorageLocal", () => {
  let diretorio: string;

  afterEach(async () => {
    if (diretorio) await rm(diretorio, { recursive: true, force: true });
  });

  it("grava o ficheiro em disco e devolve um URL derivado do baseUrl", async () => {
    diretorio = await mkdtemp(path.join(tmpdir(), "prumo-storage-"));
    const storage = criarStorageLocal(diretorio, "http://localhost:4000/files");

    const { url } = await storage.guardar(Buffer.from("conteudo de teste"), "fatura.pdf", "application/pdf");

    expect(url).toMatch(/^http:\/\/localhost:4000\/files\/[0-9a-f-]{36}-fatura\.pdf$/);
    const nomeFicheiro = url.split("/").pop()!;
    const conteudo = await readFile(path.join(diretorio, nomeFicheiro), "utf-8");
    expect(conteudo).toBe("conteudo de teste");
  });

  it("sanitiza o nome do ficheiro de forma a nunca sair do diretorio de destino", async () => {
    diretorio = await mkdtemp(path.join(tmpdir(), "prumo-storage-"));
    const storage = criarStorageLocal(diretorio, "http://localhost:4000/files");

    const { url } = await storage.guardar(Buffer.from("x"), "../../etc/passwd", "text/plain");
    const nomeFicheiro = url.split("/").pop()!;
    const caminhoResolvido = path.resolve(diretorio, nomeFicheiro);

    expect(caminhoResolvido.startsWith(path.resolve(diretorio) + path.sep)).toBe(true);
  });
});
```

- [ ] **Step 3: Correr e confirmar FAIL**

Run: `npm run test -w server -- local.test.ts`
Expected: FAIL — `local.js` não existe.

- [ ] **Step 4: Implementar `server/src/storage/local.ts`**

```ts
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Storage } from "./types.js";

export function criarStorageLocal(diretorio: string, baseUrl: string): Storage {
  return {
    async guardar(ficheiro: Buffer, nomeOriginal: string) {
      await mkdir(diretorio, { recursive: true });
      const nomeSeguro = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
      const nomeFicheiro = `${randomUUID()}-${nomeSeguro}`;
      await writeFile(path.join(diretorio, nomeFicheiro), ficheiro);
      return { url: `${baseUrl}/${nomeFicheiro}` };
    },
  };
}
```

- [ ] **Step 5: Correr e confirmar PASS**

Run: `npm run test -w server -- local.test.ts`
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add server/src/storage
git commit -m "feat: porta Storage com implementacao em disco local"
```

---

### Task 2: Rota de upload no servidor

**Files:**
- Modify: `server/package.json` (+ `multer`, `@types/multer`)
- Modify: `server/src/index.ts`
- Create: `server/uploads/.gitkeep`
- Modify: `.gitignore` (raiz) — adicionar `server/uploads/*` exceto `.gitkeep`

**Interfaces:**
- Produces: `POST http://localhost:4000/upload` (multipart, campo
  `ficheiro`) → `{ url: string }`; ficheiros servidos em
  `http://localhost:4000/files/<nome>`.

- [ ] **Step 1: Instalar dependências**

Run: `npm install multer -w server`
Run: `npm install -D @types/multer -w server`

- [ ] **Step 2: Criar `server/uploads/.gitkeep` (diretório vazio para o git seguir)**

```
```
(ficheiro vazio)

- [ ] **Step 3: Atualizar `.gitignore` na raiz**

Adicionar:
```
server/uploads/*
!server/uploads/.gitkeep
```

- [ ] **Step 4: Atualizar `server/src/index.ts`**

```ts
import express from "express";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolvers } from "./resolvers.js";
import { criarReposPrisma } from "./repos/prisma.js";
import { criarContexto } from "./context.js";
import { criarStorageLocal } from "./storage/local.js";

const typeDefs = readFileSync(new URL("../schema.graphql", import.meta.url), "utf-8");
const prisma = new PrismaClient();
const repos = criarReposPrisma(prisma);

const uploadsDir = fileURLToPath(new URL("../uploads/", import.meta.url));
const storage = criarStorageLocal(uploadsDir, "http://localhost:4000/files");

// Adaptadores de extração ainda não ligados aqui — ver Task 5/Fase 2 (email/visão em Node).
const contexto = criarContexto(repos, {
  rasterizador: { rasterizar: async () => { throw new Error("rasterizador Node não implementado no MVP-núcleo"); } },
  visao: { extrairDeImagem: async () => { throw new Error("visão Node não implementada no MVP-núcleo"); } },
});

const app = express();
const apollo = new ApolloServer({ typeDefs, resolvers });
await apollo.start();
app.use("/graphql", cors(), express.json(), expressMiddleware(apollo, { context: async () => contexto }));

app.use("/files", cors(), express.static(uploadsDir));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/upload", cors(), upload.single("ficheiro"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ erro: "Nenhum ficheiro enviado (campo 'ficheiro')." });
    return;
  }
  const { url } = await storage.guardar(req.file.buffer, req.file.originalname, req.file.mimetype);
  res.json({ url });
});

app.listen(4000, () => console.log("GraphQL em http://localhost:4000/graphql"));
```

- [ ] **Step 5: Build e verificação manual**

Run: `npm run build`
Expected: sem erros.

Run: `npm run dev:server` (em background) e depois:
```bash
echo "conteudo de teste" > /tmp/teste-upload.txt
curl -s -X POST http://localhost:4000/upload -F "ficheiro=@/tmp/teste-upload.txt"
```
Expected: `{"url":"http://localhost:4000/files/<uuid>-teste-upload.txt"}`. Confirmar
com `curl -s <url-devolvido>` que o conteúdo do ficheiro é devolvido.

Esta rota não ganha teste automático (ver spec — consistente com o resto do
bootstrap do Express, que também não tem).

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/src/index.ts server/uploads/.gitkeep .gitignore
git commit -m "feat: rota POST /upload + /files estatico no servidor"
```

---

### Task 3: Adaptadores de extração do browser

**Files:**
- Create: `web/src/upload/visaoIndisponivel.ts`
- Create: `web/src/upload/rasterizadorBrowser.ts`
- Modify: `web/package.json` (+ `pdfjs-dist` explícito)

**Interfaces:**
- Consumes: `RasterizadorAdapter`, `VisaoAdapter` de `@prumo/shared`.
- Produces: `rasterizadorBrowser: RasterizadorAdapter`,
  `visaoIndisponivel: VisaoAdapter`, usados pela Task 4.

- [ ] **Step 1: Adicionar `pdfjs-dist` como dependência direta do `web`**

Run: `npm install pdfjs-dist -w web`
(Já é dependência do `shared`, mas o `web` importa-o diretamente aqui —
melhor ser explícito do que confiar em hoisting do workspace.)

- [ ] **Step 2: Implementar `web/src/upload/visaoIndisponivel.ts`**

```ts
import type { VisaoAdapter } from "@prumo/shared";

export const visaoIndisponivel: VisaoAdapter = {
  async extrairDeImagem() {
    throw new Error("A leitura por visão ainda não está disponível — tenta uma fatura com QR legível.");
  },
};
```

- [ ] **Step 3: Implementar `web/src/upload/rasterizadorBrowser.ts`**

```ts
import type { RasterizadorAdapter } from "@prumo/shared";
import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error -- import de asset via Vite, sem tipos
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function rasterizarImagem(ficheiro: ArrayBuffer): Promise<ImageData[]> {
  const bitmap = await createImageBitmap(new Blob([ficheiro]));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return [ctx.getImageData(0, 0, canvas.width, canvas.height)];
}

async function rasterizarPdf(ficheiro: ArrayBuffer): Promise<ImageData[]> {
  const documento = await pdfjsLib.getDocument({ data: ficheiro }).promise;
  const paginas: ImageData[] = [];
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    paginas.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }
  return paginas;
}

export const rasterizadorBrowser: RasterizadorAdapter = {
  async rasterizar(ficheiro, mime) {
    return mime === "application/pdf" ? rasterizarPdf(ficheiro) : rasterizarImagem(ficheiro);
  },
};
```

Nota: a assinatura exata de `pagina.render(...)` pode variar ligeiramente
consoante a versão instalada do `pdfjs-dist` (`^4.0.0` no `package.json` do
`shared` admite vários minors). Se o build/typecheck reclamar de um campo em
falta (ex.: `canvas` no objeto de render), ajustar conforme o que o
TypeScript pedir — isto é esperado, é exatamente o "fiddly" que o CLAUDE.md
já assinalava, e é por isto que este ficheiro não tem teste automático (ver
Task 4).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: sem erros de tipo. Ajustar a chamada a `pagina.render(...)`
conforme a Nota do Step 3 se necessário.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/src/upload
git commit -m "feat: adaptadores de extracao do browser (rasterizador real + visao indisponivel)"
```

---

### Task 4: `CarregarFaturaScreen`

**Files:**
- Create: `web/src/screens/CarregarFaturaScreen.tsx`
- Create: `web/src/screens/CarregarFaturaScreen.module.css`
- Test: `web/src/screens/CarregarFaturaScreen.test.tsx`

**Interfaces:**
- Consumes: `extrairFatura`/`ResultadoExtracao` de `@prumo/shared`,
  `rasterizadorBrowser`/`visaoIndisponivel` da Task 3, `INGERIR_FATURA` de
  `web/src/graphql.ts` (já existe).
- Produces: `CarregarFaturaScreen({ extrair? })` — o prop `extrair` é o
  ponto de injeção para os testes (mesma forma que `ctx.extrair` no
  servidor: `(ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>`),
  para os testes não dependerem de canvas/`pdfjs-dist`/`jsqr` reais.

- [ ] **Step 1: Escrever `CarregarFaturaScreen.test.tsx` primeiro**

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { CarregarFaturaScreen } from "./CarregarFaturaScreen.js";
import { INGERIR_FATURA } from "../graphql.js";

function ficheiroFalso(nome = "fatura.pdf", tipo = "application/pdf") {
  return new File(["conteudo"], nome, { type: tipo });
}

const resultadoQrValido = {
  fonte: "qr" as const, qrRaw: "A:502544180*D:FT*F:20260809*G:FT1*O:50.00",
  nifFornecedor: "502544180", numeroFatura: "FT1", dataFatura: "2026-08-09",
  baseTributavel: "40.65", valorIva: "9.35", valorTotal: "50.00", nifValido: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CarregarFaturaScreen", () => {
  it("cria a despesa quando o QR é lido com sucesso", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ url: "http://localhost:4000/files/abc-fatura.pdf" }),
    }));
    const extrair = vi.fn().mockResolvedValue(resultadoQrValido);
    const mocks = [
      {
        request: {
          query: INGERIR_FATURA,
          variables: { ficheiroUrl: "http://localhost:4000/files/abc-fatura.pdf", qrRaw: resultadoQrValido.qrRaw },
        },
        result: { data: { ingerirFatura: { duplicada: false, despesa: { id: "d1", numeroFatura: "FT1", valorTotal: "50.00" } } } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <CarregarFaturaScreen extrair={extrair} />
      </MockedProvider>
    );

    await user.upload(screen.getByLabelText(/escolher ficheiro/i), ficheiroFalso());

    expect(await screen.findByText(/despesa criada/i)).toBeInTheDocument();
    expect(screen.getByText(/FT1/)).toBeInTheDocument();
  });

  it("mostra erro claro quando não encontra QR legível", async () => {
    const user = userEvent.setup();
    const extrair = vi.fn().mockRejectedValue(
      new Error("A leitura por visão ainda não está disponível — tenta uma fatura com QR legível.")
    );

    render(
      <MockedProvider mocks={[]}>
        <CarregarFaturaScreen extrair={extrair} />
      </MockedProvider>
    );

    await user.upload(screen.getByLabelText(/escolher ficheiro/i), ficheiroFalso());

    expect(await screen.findByText(/leitura por visão ainda não está disponível/i)).toBeInTheDocument();
  });

  it("mostra erro quando o upload do ficheiro falha", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const extrair = vi.fn().mockResolvedValue(resultadoQrValido);

    render(
      <MockedProvider mocks={[]}>
        <CarregarFaturaScreen extrair={extrair} />
      </MockedProvider>
    );

    await user.upload(screen.getByLabelText(/escolher ficheiro/i), ficheiroFalso());

    expect(await screen.findByText(/falha ao enviar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr e confirmar FAIL**

Run: `npm run test -w web -- CarregarFaturaScreen.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: CSS em `CarregarFaturaScreen.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-5);
  max-width: 480px;
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ui-space-2);
  padding: var(--ui-space-6);
  border: 2px dashed var(--ui-border-strong);
  border-radius: var(--ui-radius);
  color: var(--ui-fg-muted);
  font-size: 13px;
  cursor: pointer;
}

.dropzone input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}

.erro {
  color: var(--ui-danger);
  font-size: 13px;
}

.sucesso {
  color: var(--ui-success);
  font-size: 13px;
}

.aviso {
  color: var(--ui-warning);
  font-size: 13px;
}
```

- [ ] **Step 4: Implementar `CarregarFaturaScreen.tsx`**

```tsx
import { useState, type ChangeEvent } from "react";
import { useMutation } from "@apollo/client/react";
import { extrairFatura, type ResultadoExtracao } from "@prumo/shared";
import { INGERIR_FATURA } from "../graphql.js";
import { rasterizadorBrowser } from "../upload/rasterizadorBrowser.js";
import { visaoIndisponivel } from "../upload/visaoIndisponivel.js";
import { Card } from "../ui/Card.js";
import styles from "./CarregarFaturaScreen.module.css";

const extrairPadrao = (ficheiro: ArrayBuffer, mime: string): Promise<ResultadoExtracao> =>
  extrairFatura(ficheiro, mime, { rasterizador: rasterizadorBrowser, visao: visaoIndisponivel });

type Estado =
  | { fase: "idle" }
  | { fase: "processando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "sucesso"; duplicada: boolean; numeroFatura: string; valorTotal: string };

export function CarregarFaturaScreen({
  extrair = extrairPadrao,
}: {
  extrair?: (ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>;
}) {
  const [ingerirFatura] = useMutation(INGERIR_FATURA);
  const [estado, setEstado] = useState<Estado>({ fase: "idle" });

  async function processarFicheiro(ficheiro: File) {
    setEstado({ fase: "processando" });
    try {
      const buffer = await ficheiro.arrayBuffer();
      const extraido = await extrair(buffer, ficheiro.type);
      if (!extraido.qrRaw) throw new Error("Não foi possível ler o QR desta fatura.");

      const formData = new FormData();
      formData.append("ficheiro", ficheiro);
      const respostaUpload = await fetch("http://localhost:4000/upload", { method: "POST", body: formData });
      if (!respostaUpload.ok) throw new Error("Falha ao enviar o ficheiro para o servidor.");
      const { url: ficheiroUrl } = await respostaUpload.json();

      const { data } = await ingerirFatura({ variables: { ficheiroUrl, qrRaw: extraido.qrRaw } });
      const resultado = data!.ingerirFatura;
      setEstado({
        fase: "sucesso", duplicada: resultado.duplicada,
        numeroFatura: resultado.despesa.numeroFatura, valorTotal: resultado.despesa.valorTotal,
      });
    } catch (e) {
      setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : "Erro desconhecido." });
    }
  }

  function aoEscolherFicheiro(e: ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (ficheiro) void processarFicheiro(ficheiro);
    e.target.value = "";
  }

  return (
    <div className={styles.page}>
      <div className={styles.title}>Carregar Fatura</div>
      <Card>
        <label className={styles.dropzone}>
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={aoEscolherFicheiro} />
          Escolher ficheiro ou tirar foto
        </label>

        {estado.fase === "processando" && <p>A ler o QR da fatura...</p>}
        {estado.fase === "erro" && <p className={styles.erro}>{estado.mensagem}</p>}
        {estado.fase === "sucesso" && !estado.duplicada && (
          <p className={styles.sucesso}>Despesa criada: {estado.numeroFatura} — {estado.valorTotal} €</p>
        )}
        {estado.fase === "sucesso" && estado.duplicada && (
          <p className={styles.aviso}>Esta fatura já tinha sido lida antes ({estado.numeroFatura}).</p>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Correr e confirmar PASS**

Run: `npm run test -w web -- CarregarFaturaScreen.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add web/src/screens/CarregarFaturaScreen.tsx web/src/screens/CarregarFaturaScreen.module.css web/src/screens/CarregarFaturaScreen.test.tsx
git commit -m "feat: ecra CarregarFaturaScreen (upload real + leitura de QR no browser)"
```

---

### Task 5: Ligar rota e navegação

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/ui/AppShell.tsx`

- [ ] **Step 1: Adicionar a rota em `App.tsx`**

```tsx
import { CarregarFaturaScreen } from "./screens/CarregarFaturaScreen.js";
// ...
<Route path="/carregar-fatura" element={<CarregarFaturaScreen />} />
```

- [ ] **Step 2: Adicionar o item de navegação principal em `AppShell.tsx`**

Em `NAV_ITEMS`, logo a seguir a `Fila de Revisão` (é o ponto de entrada do
fluxo todo):

```ts
const NAV_ITEMS = [
  { to: "/", label: "Fila de Revisão" },
  { to: "/carregar-fatura", label: "Carregar Fatura" },
  { to: "/obras", label: "Obras" },
  { to: "/fornecedores", label: "Fornecedores" },
  { to: "/despesas", label: "Despesas" },
  { to: "/utilizadores", label: "Utilizadores" },
];
```

- [ ] **Step 3: Build e suite completa**

Run: `npm run build`
Run: `npm test`
Expected: build limpo, todos os testes a passar.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx web/src/ui/AppShell.tsx
git commit -m "feat: liga a rota /carregar-fatura e o item de navegacao"
```

---

### Task 6: Verificação manual ponta-a-ponta

Não automatizável (canvas/pdfjs/jsqr reais — ver spec). Com
`docker compose up -d db`, `npm run dev:server` e `npm run dev:web` a
correr:

- [ ] Abrir `/carregar-fatura`, carregar uma fatura real com QR de Portaria
  195/2020 (PDF ou foto). Confirmar: mensagem "A ler o QR..." →
  "Despesa criada: ...". Confirmar que a despesa aparece na Fila de Revisão.
- [ ] Recarregar a mesma fatura outra vez. Confirmar mensagem de duplicada,
  sem criar uma segunda despesa.
- [ ] Carregar uma imagem/PDF sem QR legível (ex.: uma foto qualquer).
  Confirmar mensagem de erro clara, nenhuma despesa criada, nenhum ficheiro
  novo em `server/uploads/`.
- [ ] Confirmar em `curl http://localhost:4000/files/<nome-do-ficheiro>`
  que o ficheiro da primeira fatura foi mesmo guardado e é servido de volta.

## Self-Review

**Cobertura da spec:** armazenamento local (Task 1-2) ✅; adaptadores reais
do browser (Task 3) ✅; ecrã completo com os três estados de erro previstos
(QR não encontrado, upload falha, duplicada) (Task 4) ✅; navegação (Task 5)
✅; limite documentado de que a rasterização real não tem teste automático,
com verificação manual explícita (Task 6) ✅. Fallback de visão e S3/R2
ficam de fora, como decidido.

**Placeholders:** nenhum "TODO"/"TBD" — a única incerteza documentada
(assinatura exata de `pagina.render()` consoante o minor do `pdfjs-dist`) é
um risco real assinalado explicitamente, não um placeholder por preguiça.

**Consistência de tipos:** `extrair` tem a mesma assinatura em todo o lado
(`(ArrayBuffer, string) => Promise<ResultadoExtracao>`), espelhando
`GraphQLContext.extrair` já existente no servidor — não há um nome a mais
nem a menos entre a Task 3, a Task 4 e os testes.
