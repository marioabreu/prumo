# MVP — Núcleo (Despesas por Obra) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end MVP loop end-to-end and runnable locally: upload a fatura (foto/PDF) → extração QR-first com fallback de visão → fila de revisão humana onde o único campo a escolher é a obra → confirmação → somatório por obra correto em Postgres.

**Architecture:** Monorepo npm workspaces (`shared/`, `server/`, `web/`). `shared/extraction` faz QR-first + fallback de visão e corre tanto no browser (upload) como em Node (mantido genérico já agora, o adaptador de email fica fora deste plano — ver Fases seguintes). `server` expõe GraphQL (Apollo Server) sobre uma porta `Repos` DB-agnóstica; `server/src/repos/prisma.ts` implementa-a sobre Postgres, `server/src/repos/memoria.ts` é usada só em testes unitários dos resolvers. `web` é React + Apollo Client, mobile-first, com a fila de revisão keyboard-first.

**Tech Stack:** TypeScript 5.4 (strict) em todo o lado · Node 20+ · Apollo Server 4 + graphql-tag · Prisma 5 sobre Postgres 16 (via `docker-compose`) · React 18 + Vite 5 + Apollo Client · Vitest + Testing Library · `jsqr` + `pdfjs-dist` para o QR.

## Global Constraints

- Dinheiro é sempre `Prisma.Decimal` / SQL `NUMERIC` — nunca `number`/`Float` em domínio real. Só `server/src/repos/memoria.ts` (impl. de teste) pode usar `number`, e tem de ter um comentário a dizer que é só para testes.
- Somatórios por obra fazem-se em SQL (`groupBy`/`SUM`), nunca somando em JS.
- Deduplicação por `(nifFornecedor, numeroFatura, dataFatura)` — constraint única na BD; `ingerirFatura` verifica antes de criar e devolve `duplicada: true` em vez de duplicar ou rebentar.
- Lock de revisão com TTL de 5 minutos (`LOCK_TTL_MS = 5 * 60 * 1000`); lock de outro utilizador ainda válido bloqueia; lock expirado é ignorado.
- `ficheiroUrl` e `qrRaw` são imutáveis após criação da despesa — nenhum resolver de update os pode tocar.
- `sugerirObra` devolve sempre `{ obraId, motivo, score }` ou `null` se `score < 0.6` — nunca um palpite sem `motivo`.
- `Obra` é FK controlada (`obraId` em `Despesa`), nunca texto livre.
- Todos os pacotes (`shared`, `server`, `web`) compilam com `tsc --noEmit` sem erros antes de cada commit.

## File Structure

```
/
├─ package.json                     # workspaces root
├─ tsconfig.base.json
├─ .gitignore
├─ docker-compose.yml                # Postgres 16 local
├─ .env.example                      # DATABASE_URL
├─ shared/
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ extraction/
│     ├─ types.ts                    # FaturaQR, ResultadoExtracao, adaptadores
│     ├─ qr-fatura.ts                # trazido de Downloads/qr-fatura.ts (já existe, só copiar+testar)
│     ├─ qr-fatura.test.ts
│     ├─ extrair-fatura.ts           # QR-first + fallback visão, DI de adaptadores
│     └─ extrair-fatura.test.ts
├─ server/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ schema.graphql
│  ├─ prisma/
│  │  └─ schema.prisma
│  └─ src/
│     ├─ index.ts                    # bootstrap Apollo Server + Express
│     ├─ context.ts                  # monta ctx: repos, extrair, loaders
│     ├─ resolvers.ts
│     ├─ resolvers.test.ts
│     ├─ repos/
│     │  ├─ types.ts                 # porta Repos
│     │  ├─ memoria.ts               # impl. em memória (testes)
│     │  ├─ memoria.test.ts
│     │  ├─ prisma.ts                # impl. Prisma (Postgres real)
│     │  └─ prisma.test.ts           # integração, corre contra docker-compose
│     ├─ sugestao/
│     │  ├─ sugerir-obra.ts
│     │  └─ sugerir-obra.test.ts
│     └─ loaders/
│        └─ index.ts                 # DataLoader por request
└─ web/
   ├─ package.json
   ├─ vite.config.ts
   ├─ tsconfig.json
   ├─ index.html
   └─ src/
      ├─ main.tsx
      ├─ App.tsx
      ├─ apollo.ts
      ├─ graphql.ts                  # queries/mutations tipadas (gql`` tags)
      ├─ FilaRevisao.tsx
      ├─ FilaRevisao.test.tsx
      └─ setupTests.ts
```

**Nota sobre os "protótipos existentes" do CLAUDE.md:** só `qr-fatura.ts` foi encontrado de facto (idêntico em `~/Downloads/qr-fatura.ts` e `~/projects/personal projects/prumo/qr-fatura.ts`) — está integrado na Fase 5 (Task 5). `extrair-fatura.ts`, `sugerir-obra.ts`, `schema.graphql` do domínio, `resolvers.ts` e `fila-revisao-preview.jsx` não foram encontrados em disco; este plano escreve-os de raiz a partir das Decisões de Design (secção 6 do CLAUDE.md), não os "porta". Se esses ficheiros existirem noutro sítio (outro portátil, gist, etc.), diz onde estão antes de começar a Fase 5/6/7 e ajusto para portar em vez de reescrever.

---

### Task 1: Scaffold do monorepo

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `shared/package.json`, `shared/tsconfig.json`
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `web/` (via `npm create vite@latest web -- --template react-ts`)

**Interfaces:**
- Produces: comando `npm run build` na raiz corre `tsc --noEmit` nos 3 workspaces; `npm run dev:server` e `npm run dev:web` arrancam cada serviço.

- [ ] **Step 1: Criar `package.json` raiz com workspaces**

```json
{
  "name": "prumo",
  "private": true,
  "workspaces": ["shared", "server", "web"],
  "scripts": {
    "build": "npm run build -ws --if-present",
    "test": "npm run test -ws --if-present",
    "dev:server": "npm run dev -w server",
    "dev:web": "npm run dev -w web"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Criar `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 4: Criar `docker-compose.yml` (Postgres local)**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: prumo
      POSTGRES_PASSWORD: prumo
      POSTGRES_DB: prumo
    ports:
      - "5432:5432"
    volumes:
      - prumo-db:/var/lib/postgresql/data
volumes:
  prumo-db:
```

- [ ] **Step 5: Criar `.env.example`**

```
DATABASE_URL="postgresql://prumo:prumo@localhost:5432/prumo"
```

- [ ] **Step 6: Scaffold `shared/`**

`shared/package.json`:
```json
{
  "name": "@prumo/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "extraction/extrair-fatura.ts",
  "scripts": { "build": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "jsqr": "^1.4.0", "pdfjs-dist": "^4.0.0" },
  "devDependencies": { "vitest": "^1.4.0" }
}
```

`shared/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["extraction"] }
```

- [ ] **Step 7: Scaffold `server/`**

`server/package.json`:
```json
{
  "name": "@prumo/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@apollo/server": "^4.10.0",
    "@prisma/client": "^5.11.0",
    "graphql": "^16.8.1",
    "dataloader": "^2.2.2",
    "express": "^4.19.0",
    "@as-integrations/express5": "^1.1.0",
    "@prumo/shared": "*"
  },
  "devDependencies": { "prisma": "^5.11.0", "tsx": "^4.7.0", "vitest": "^1.4.0" }
}
```

`server/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 8: Scaffold `web/` com Vite**

Run: `npm create vite@latest web -- --template react-ts` (a partir da raiz do repo), depois adicionar `@apollo/client`, `graphql`:

Run: `npm install @apollo/client graphql -w web`

- [ ] **Step 9: Instalar tudo e confirmar que compila**

Run: `npm install`
Run: `npm run build`
Expected: sem erros TypeScript nos 3 workspaces (o `server` pode falhar aqui por faltar `src/index.ts` — criar um `src/index.ts` vazio com `export {}` só para este passo passar; será substituído na Task 6).

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.base.json .gitignore docker-compose.yml .env.example shared server web
git commit -m "chore: scaffold monorepo (shared/server/web workspaces)"
```

---

### Task 2: Prisma schema (Obra, Fornecedor, Despesa, Utilizador)

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/src/repos/prisma.test.ts` (parte 1 — só a migração + constraint, o resto do impl vem na Task 3)

**Interfaces:**
- Produces: `PrismaClient` gerado com models `Obra`, `Fornecedor`, `Despesa`, `Utilizador`; enum `EstadoDespesa`; constraint única `Despesa_dedup_key` em `(nifFornecedor, numeroFatura, dataFatura)`; índice em `estado` para a fila.

- [ ] **Step 1: Escrever `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EstadoDespesa {
  POR_REVER
  CONFIRMADA
  ADIADA
}

enum OrigemDespesa {
  UPLOAD
  EMAIL
}

model Obra {
  id       String    @id @default(cuid())
  nome     String    @unique
  ativa    Boolean   @default(true)
  despesas Despesa[]
}

model Fornecedor {
  id       String    @id @default(cuid())
  nif      String    @unique
  nome     String?
  morada   String?
  despesas Despesa[]
}

model Utilizador {
  id    String @id @default(cuid())
  nome  String
  email String @unique
}

model Despesa {
  id              String        @id @default(cuid())
  nifFornecedor   String
  fornecedor      Fornecedor?   @relation(fields: [fornecedorId], references: [id])
  fornecedorId    String?
  numeroFatura    String
  dataFatura      String
  baseTributavel  Decimal       @db.Decimal(12, 2)
  valorIva        Decimal       @db.Decimal(12, 2)
  valorTotal      Decimal       @db.Decimal(12, 2)
  ficheiroUrl     String
  qrRaw           String?
  origem          OrigemDespesa @default(UPLOAD)
  obra            Obra?         @relation(fields: [obraId], references: [id])
  obraId          String?
  estado          EstadoDespesa @default(POR_REVER)
  lockPorId       String?
  lockExpiraEm    DateTime?
  criadaEm        DateTime      @default(now())
  atualizadaEm    DateTime      @updatedAt

  @@unique([nifFornecedor, numeroFatura, dataFatura], name: "dedupKey")
  @@index([estado])
}
```

- [ ] **Step 2: Subir Postgres local e correr a primeira migração**

Run: `docker compose up -d db`
Run: `cp .env.example .env` (dentro de `server/`, ou export `DATABASE_URL` a partir da raiz)
Run: `npm run prisma:migrate -w server -- --name init`
Expected: migração aplicada sem erros, `server/prisma/migrations/<timestamp>_init/` criado.

- [ ] **Step 3: Escrever teste de integração que prova a constraint de dedup**

```ts
// server/src/repos/prisma.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.despesa.deleteMany();
  await prisma.fornecedor.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("constraint de dedup", () => {
  it("rejeita uma segunda despesa com a mesma chave nif+numero+data", async () => {
    const dados = {
      nifFornecedor: "502544180",
      numeroFatura: "FT 101/118388419",
      dataFatura: "2026-07-25",
      baseTributavel: "21.09",
      valorIva: "4.86",
      valorTotal: "25.95",
      ficheiroUrl: "https://exemplo/f1.pdf",
    };
    await prisma.despesa.create({ data: dados });
    await expect(prisma.despesa.create({ data: dados })).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Correr o teste e confirmar que passa**

Run: `npm run test -w server -- prisma.test.ts`
Expected: PASS (a segunda `create` rebenta com `PrismaClientKnownRequestError P2002`).

- [ ] **Step 5: Commit**

```bash
git add server/prisma server/src/repos/prisma.test.ts
git commit -m "feat: prisma schema com constraint de dedup e indice de fila"
```

---

### Task 3: Porta `Repos` + implementação Prisma + implementação em memória

**Files:**
- Create: `server/src/repos/types.ts`
- Create: `server/src/repos/memoria.ts`
- Create: `server/src/repos/memoria.test.ts`
- Create: `server/src/repos/prisma.ts`
- Modify: `server/src/repos/prisma.test.ts` (adicionar testes de `totaisPorObra` e `lockAtivoDeOutro`)

**Interfaces:**
- Consumes: `PrismaClient` gerado na Task 2, models `Despesa`/`Obra`/`Fornecedor`.
- Produces: interface `Repos` — `criarReposMemoria(): Repos` e `criarReposPrisma(prisma: PrismaClient): Repos`, ambas usadas por `context.ts` na Task 6.

- [ ] **Step 1: Definir a porta em `server/src/repos/types.ts`**

```ts
export type EstadoDespesa = "POR_REVER" | "CONFIRMADA" | "ADIADA";

export interface Obra {
  id: string;
  nome: string;
  ativa: boolean;
}

export interface Fornecedor {
  id: string;
  nif: string;
  nome: string | null;
  morada: string | null;
}

export interface Despesa {
  id: string;
  nifFornecedor: string;
  fornecedorId: string | null;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string; // Decimal como string — nunca number no domínio real
  valorIva: string;
  valorTotal: string;
  ficheiroUrl: string;
  qrRaw: string | null;
  origem: "UPLOAD" | "EMAIL";
  obraId: string | null;
  estado: EstadoDespesa;
  lockPorId: string | null;
  lockExpiraEm: Date | null;
  criadaEm: Date;
}

export interface CriarDespesaInput {
  nifFornecedor: string;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string;
  valorIva: string;
  valorTotal: string;
  ficheiroUrl: string;
  qrRaw: string | null;
  origem: "UPLOAD" | "EMAIL";
}

export interface AtualizarValoresInput {
  baseTributavel?: string;
  valorIva?: string;
  valorTotal?: string;
}

export interface TotalObra {
  obraId: string;
  total: string;
}

export const LOCK_TTL_MS = 5 * 60 * 1000;

export interface Repos {
  obras: {
    listar(): Promise<Obra[]>;
    ativas(): Promise<Obra[]>;
    obterPorId(id: string): Promise<Obra | null>;
  };
  fornecedores: {
    obterPorNif(nif: string): Promise<Fornecedor | null>;
    upsert(nif: string, nome?: string | null): Promise<Fornecedor>;
    historico(nif: string, limite: number): Promise<Despesa[]>;
  };
  despesas: {
    obterPorChaveDedup(
      nifFornecedor: string,
      numeroFatura: string,
      dataFatura: string
    ): Promise<Despesa | null>;
    criar(input: CriarDespesaInput): Promise<Despesa>;
    obterPorId(id: string): Promise<Despesa | null>;
    listarFila(estado?: EstadoDespesa): Promise<Despesa[]>;
    bloquear(id: string, utilizadorId: string): Promise<Despesa>;
    atribuirObra(id: string, obraId: string): Promise<Despesa>;
    atualizarValores(id: string, patch: AtualizarValoresInput): Promise<Despesa>;
    confirmar(id: string): Promise<Despesa>;
    adiar(id: string): Promise<Despesa>;
    totaisPorObra(): Promise<TotalObra[]>;
  };
}

export function lockAtivoDeOutro(
  despesa: Pick<Despesa, "lockPorId" | "lockExpiraEm">,
  utilizadorId: string,
  agora: Date = new Date()
): boolean {
  if (!despesa.lockPorId || despesa.lockPorId === utilizadorId) return false;
  if (!despesa.lockExpiraEm) return false;
  return despesa.lockExpiraEm.getTime() > agora.getTime();
}
```

- [ ] **Step 2: Escrever o teste de `lockAtivoDeOutro` primeiro (é lógica pura, testa-se isolada)**

```ts
// server/src/repos/memoria.test.ts
import { describe, it, expect } from "vitest";
import { lockAtivoDeOutro } from "./types.js";

describe("lockAtivoDeOutro", () => {
  const base = { lockPorId: null, lockExpiraEm: null };

  it("false quando não há lock", () => {
    expect(lockAtivoDeOutro(base, "user-1")).toBe(false);
  });

  it("false quando o lock é do próprio utilizador", () => {
    const agora = new Date("2026-08-08T10:00:00Z");
    const despesa = { lockPorId: "user-1", lockExpiraEm: new Date("2026-08-08T10:04:00Z") };
    expect(lockAtivoDeOutro(despesa, "user-1", agora)).toBe(false);
  });

  it("true quando é lock de outro utilizador e ainda não expirou", () => {
    const agora = new Date("2026-08-08T10:00:00Z");
    const despesa = { lockPorId: "user-2", lockExpiraEm: new Date("2026-08-08T10:04:00Z") };
    expect(lockAtivoDeOutro(despesa, "user-1", agora)).toBe(true);
  });

  it("false quando é de outro utilizador mas já expirou (TTL 5 min)", () => {
    const agora = new Date("2026-08-08T10:06:00Z");
    const despesa = { lockPorId: "user-2", lockExpiraEm: new Date("2026-08-08T10:04:00Z") };
    expect(lockAtivoDeOutro(despesa, "user-1", agora)).toBe(false);
  });
});
```

- [ ] **Step 3: Correr e confirmar que falha (função ainda não implementada nesta ordem — na verdade já foi escrita no Step 1 acima; inverter: escrever só a assinatura vazia primeiro)**

Run: `npm run test -w server -- memoria.test.ts`
Expected: se seguires TDD à risca, escreve `lockAtivoDeOutro` a devolver sempre `false` no Step 1, confirma FAIL nos casos `true`, só depois preenche a lógica real acima e confirma PASS. Ambas as ordens chegam ao mesmo `types.ts` final acima.

- [ ] **Step 4: Confirmar que os 4 casos passam**

Run: `npm run test -w server -- memoria.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Implementar `server/src/repos/memoria.ts`**

```ts
import { randomUUID } from "node:crypto";
import type {
  Repos, Obra, Fornecedor, Despesa, CriarDespesaInput,
  AtualizarValoresInput, TotalObra, EstadoDespesa,
} from "./types.js";
import { lockAtivoDeOutro, LOCK_TTL_MS } from "./types.js";

/** Impl. em memória para testes de resolvers. Usa `number` só por conveniência — NUNCA copiar isto para o impl. Prisma (ver CLAUDE.md decisão #1). */
export function criarReposMemoria(seedObras: Omit<Obra, "id">[] = []): Repos {
  const obras = new Map<string, Obra>();
  const fornecedores = new Map<string, Fornecedor>();
  const despesas = new Map<string, Despesa>();

  for (const o of seedObras) {
    const id = randomUUID();
    obras.set(id, { ...o, id });
  }

  function encontrarPorDedup(nif: string, numero: string, data: string) {
    return [...despesas.values()].find(
      (d) => d.nifFornecedor === nif && d.numeroFatura === numero && d.dataFatura === data
    );
  }

  return {
    obras: {
      async listar() { return [...obras.values()]; },
      async ativas() { return [...obras.values()].filter((o) => o.ativa); },
      async obterPorId(id) { return obras.get(id) ?? null; },
    },
    fornecedores: {
      async obterPorNif(nif) {
        return [...fornecedores.values()].find((f) => f.nif === nif) ?? null;
      },
      async upsert(nif, nome = null) {
        const existente = [...fornecedores.values()].find((f) => f.nif === nif);
        if (existente) return existente;
        const id = randomUUID();
        const f: Fornecedor = { id, nif, nome, morada: null };
        fornecedores.set(id, f);
        return f;
      },
      async historico(nif, limite) {
        return [...despesas.values()]
          .filter((d) => d.nifFornecedor === nif)
          .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime())
          .slice(0, limite);
      },
    },
    despesas: {
      async obterPorChaveDedup(nif, numero, data) {
        return encontrarPorDedup(nif, numero, data) ?? null;
      },
      async criar(input: CriarDespesaInput) {
        const id = randomUUID();
        const despesa: Despesa = {
          id,
          ...input,
          fornecedorId: null,
          obraId: null,
          estado: "POR_REVER",
          lockPorId: null,
          lockExpiraEm: null,
          criadaEm: new Date(),
        };
        despesas.set(id, despesa);
        return despesa;
      },
      async obterPorId(id) { return despesas.get(id) ?? null; },
      async listarFila(estado?: EstadoDespesa) {
        const todas = [...despesas.values()];
        return estado ? todas.filter((d) => d.estado === estado) : todas;
      },
      async bloquear(id, utilizadorId) {
        const d = despesas.get(id);
        if (!d) throw new Error(`Despesa ${id} não encontrada`);
        if (lockAtivoDeOutro(d, utilizadorId)) {
          throw new Error("Despesa já está bloqueada por outro revisor");
        }
        d.lockPorId = utilizadorId;
        d.lockExpiraEm = new Date(Date.now() + LOCK_TTL_MS);
        return d;
      },
      async atribuirObra(id, obraId) {
        const d = despesas.get(id);
        if (!d) throw new Error(`Despesa ${id} não encontrada`);
        d.obraId = obraId;
        return d;
      },
      async atualizarValores(id, patch: AtualizarValoresInput) {
        const d = despesas.get(id);
        if (!d) throw new Error(`Despesa ${id} não encontrada`);
        Object.assign(d, patch); // nunca toca ficheiroUrl/qrRaw — não estão em AtualizarValoresInput
        return d;
      },
      async confirmar(id) {
        const d = despesas.get(id);
        if (!d) throw new Error(`Despesa ${id} não encontrada`);
        d.estado = "CONFIRMADA";
        return d;
      },
      async adiar(id) {
        const d = despesas.get(id);
        if (!d) throw new Error(`Despesa ${id} não encontrada`);
        d.estado = "ADIADA";
        return d;
      },
      async totaisPorObra(): Promise<TotalObra[]> {
        const somas = new Map<string, number>();
        for (const d of despesas.values()) {
          if (d.estado !== "CONFIRMADA" || !d.obraId) continue;
          somas.set(d.obraId, (somas.get(d.obraId) ?? 0) + Number(d.valorTotal));
        }
        return [...somas.entries()].map(([obraId, total]) => ({ obraId, total: total.toFixed(2) }));
      },
    },
  };
}
```

- [ ] **Step 6: Testes do repo em memória — dedup, lock, totais**

```ts
// adicionar a server/src/repos/memoria.test.ts
import { criarReposMemoria } from "./memoria.js";

describe("criarReposMemoria", () => {
  const inputBase = {
    nifFornecedor: "502544180",
    numeroFatura: "FT 101/118388419",
    dataFatura: "2026-07-25",
    baseTributavel: "21.09",
    valorIva: "4.86",
    valorTotal: "25.95",
    ficheiroUrl: "https://exemplo/f1.pdf",
    qrRaw: null,
    origem: "UPLOAD" as const,
  };

  it("obterPorChaveDedup encontra uma despesa já criada", async () => {
    const repos = criarReposMemoria();
    await repos.despesas.criar(inputBase);
    const achada = await repos.despesas.obterPorChaveDedup(
      inputBase.nifFornecedor, inputBase.numeroFatura, inputBase.dataFatura
    );
    expect(achada).not.toBeNull();
  });

  it("bloquear rejeita quando já há lock ativo de outro utilizador", async () => {
    const repos = criarReposMemoria();
    const d = await repos.despesas.criar(inputBase);
    await repos.despesas.bloquear(d.id, "user-1");
    await expect(repos.despesas.bloquear(d.id, "user-2")).rejects.toThrow();
  });

  it("totaisPorObra só soma despesas CONFIRMADA com obraId", async () => {
    const repos = criarReposMemoria([{ nome: "Obra Norte", ativa: true }]);
    const [obra] = await repos.obras.listar();
    const d1 = await repos.despesas.criar(inputBase);
    await repos.despesas.atribuirObra(d1.id, obra.id);
    await repos.despesas.confirmar(d1.id);
    const d2 = await repos.despesas.criar({ ...inputBase, numeroFatura: "FT 102" });
    await repos.despesas.atribuirObra(d2.id, obra.id); // não confirmada — não deve contar

    const totais = await repos.despesas.totaisPorObra();
    expect(totais).toEqual([{ obraId: obra.id, total: "25.95" }]);
  });
});
```

- [ ] **Step 7: Correr e confirmar PASS**

Run: `npm run test -w server -- memoria.test.ts`
Expected: PASS (7/7 incluindo os 4 de `lockAtivoDeOutro`).

- [ ] **Step 8: Implementar `server/src/repos/prisma.ts`**

```ts
import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  Repos, CriarDespesaInput, AtualizarValoresInput, TotalObra, EstadoDespesa,
} from "./types.js";
import { lockAtivoDeOutro, LOCK_TTL_MS } from "./types.js";

function paraDominio(d: {
  baseTributavel: Prisma.Decimal; valorIva: Prisma.Decimal; valorTotal: Prisma.Decimal;
} & Record<string, unknown>) {
  return {
    ...d,
    baseTributavel: d.baseTributavel.toFixed(2),
    valorIva: d.valorIva.toFixed(2),
    valorTotal: d.valorTotal.toFixed(2),
  } as any;
}

export function criarReposPrisma(prisma: PrismaClient): Repos {
  return {
    obras: {
      async listar() { return prisma.obra.findMany(); },
      async ativas() { return prisma.obra.findMany({ where: { ativa: true } }); },
      async obterPorId(id) { return prisma.obra.findUnique({ where: { id } }); },
    },
    fornecedores: {
      async obterPorNif(nif) { return prisma.fornecedor.findUnique({ where: { nif } }); },
      async upsert(nif, nome = null) {
        return prisma.fornecedor.upsert({
          where: { nif },
          update: nome ? { nome } : {},
          create: { nif, nome },
        });
      },
      async historico(nif, limite) {
        const rows = await prisma.despesa.findMany({
          where: { nifFornecedor: nif },
          orderBy: { criadaEm: "desc" },
          take: limite,
        });
        return rows.map(paraDominio);
      },
    },
    despesas: {
      async obterPorChaveDedup(nifFornecedor, numeroFatura, dataFatura) {
        const row = await prisma.despesa.findUnique({
          where: { dedupKey: { nifFornecedor, numeroFatura, dataFatura } },
        });
        return row ? paraDominio(row) : null;
      },
      async criar(input: CriarDespesaInput) {
        const row = await prisma.despesa.create({ data: input });
        return paraDominio(row);
      },
      async obterPorId(id) {
        const row = await prisma.despesa.findUnique({ where: { id } });
        return row ? paraDominio(row) : null;
      },
      async listarFila(estado?: EstadoDespesa) {
        const rows = await prisma.despesa.findMany({
          where: estado ? { estado } : undefined,
          orderBy: { criadaEm: "asc" },
        });
        return rows.map(paraDominio);
      },
      async bloquear(id, utilizadorId) {
        const atual = await prisma.despesa.findUniqueOrThrow({ where: { id } });
        if (lockAtivoDeOutro(atual, utilizadorId)) {
          throw new Error("Despesa já está bloqueada por outro revisor");
        }
        const row = await prisma.despesa.update({
          where: { id },
          data: { lockPorId: utilizadorId, lockExpiraEm: new Date(Date.now() + LOCK_TTL_MS) },
        });
        return paraDominio(row);
      },
      async atribuirObra(id, obraId) {
        const row = await prisma.despesa.update({ where: { id }, data: { obraId } });
        return paraDominio(row);
      },
      async atualizarValores(id, patch: AtualizarValoresInput) {
        const row = await prisma.despesa.update({ where: { id }, data: patch });
        return paraDominio(row);
      },
      async confirmar(id) {
        const row = await prisma.despesa.update({ where: { id }, data: { estado: "CONFIRMADA" } });
        return paraDominio(row);
      },
      async adiar(id) {
        const row = await prisma.despesa.update({ where: { id }, data: { estado: "ADIADA" } });
        return paraDominio(row);
      },
      async totaisPorObra(): Promise<TotalObra[]> {
        const grupos = await prisma.despesa.groupBy({
          by: ["obraId"],
          where: { estado: "CONFIRMADA", obraId: { not: null } },
          _sum: { valorTotal: true },
        });
        return grupos
          .filter((g) => g.obraId !== null)
          .map((g) => ({ obraId: g.obraId as string, total: g._sum.valorTotal!.toFixed(2) }));
      },
    },
  };
}
```

- [ ] **Step 9: Adicionar testes de integração equivalentes contra Postgres real**

```ts
// adicionar a server/src/repos/prisma.test.ts
import { criarReposPrisma } from "./prisma.js";

describe("criarReposPrisma — totaisPorObra em SQL", () => {
  it("soma em SQL, não em JS, e devolve string com 2 casas decimais", async () => {
    await prisma.obra.deleteMany();
    const obra = await prisma.obra.create({ data: { nome: "Obra Sul" } });
    const repos = criarReposPrisma(prisma);
    const d = await repos.despesas.criar({
      nifFornecedor: "502544180", numeroFatura: "FT 200", dataFatura: "2026-08-01",
      baseTributavel: "10.00", valorIva: "2.30", valorTotal: "12.30",
      ficheiroUrl: "https://exemplo/f2.pdf", qrRaw: null, origem: "UPLOAD",
    });
    await repos.despesas.atribuirObra(d.id, obra.id);
    await repos.despesas.confirmar(d.id);

    const totais = await repos.despesas.totaisPorObra();
    expect(totais).toEqual([{ obraId: obra.id, total: "12.30" }]);
  });
});
```

- [ ] **Step 10: Correr toda a suite do server e confirmar PASS**

Run: `npm run test -w server`
Expected: PASS em `memoria.test.ts` e `prisma.test.ts` (Postgres local tem de estar a correr — `docker compose up -d db`).

- [ ] **Step 11: Commit**

```bash
git add server/src/repos
git commit -m "feat: porta Repos com impl. em memoria e em Prisma (dedup, lock TTL, totais em SQL)"
```

---

### Task 4: `sugerir-obra.ts` — heurística explicável

**Files:**
- Create: `server/src/sugestao/sugerir-obra.ts`
- Create: `server/src/sugestao/sugerir-obra.test.ts`

**Interfaces:**
- Consumes: `Despesa`, `Obra` de `server/src/repos/types.ts`.
- Produces: `sugerirObra(historico: Despesa[], obrasAtivas: Obra[], scoreMin = 0.6): SugestaoObra | null`, usada pelo resolver `Query.sugestaoObra` na Task 6.

- [ ] **Step 1: Escrever o teste do caso central primeiro (CLAUDE.md decisão #5: "3 das últimas 4 faturas deste fornecedor")**

```ts
// server/src/sugestao/sugerir-obra.test.ts
import { describe, it, expect } from "vitest";
import { sugerirObra } from "./sugerir-obra.js";
import type { Despesa, Obra } from "../repos/types.js";

function despesaHistorico(obraId: string, diasAtras: number): Despesa {
  const criadaEm = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
  return {
    id: `d-${obraId}-${diasAtras}`, nifFornecedor: "502544180", fornecedorId: null,
    numeroFatura: "x", dataFatura: "2026-01-01", baseTributavel: "1", valorIva: "1", valorTotal: "1",
    ficheiroUrl: "x", qrRaw: null, origem: "UPLOAD", obraId, estado: "CONFIRMADA",
    lockPorId: null, lockExpiraEm: null, criadaEm,
  };
}

describe("sugerirObra", () => {
  const obraA: Obra = { id: "obra-a", nome: "Obra A", ativa: true };
  const obraB: Obra = { id: "obra-b", nome: "Obra B", ativa: true };

  it("sugere a obra dominante quando 3 das ultimas 4 faturas do fornecedor foram para lá", () => {
    const historico = [
      despesaHistorico(obraA.id, 1), despesaHistorico(obraA.id, 5),
      despesaHistorico(obraA.id, 10), despesaHistorico(obraB.id, 20),
    ];
    const sugestao = sugerirObra(historico, [obraA, obraB]);
    expect(sugestao?.obraId).toBe(obraA.id);
    expect(sugestao?.motivo).toContain("3 das últimas 4 faturas deste fornecedor");
  });

  it("devolve null (não adivinha) abaixo do threshold de 0.6", () => {
    const historico = [despesaHistorico(obraA.id, 1), despesaHistorico(obraB.id, 2)];
    const sugestao = sugerirObra(historico, [obraA, obraB]);
    expect(sugestao).toBeNull();
  });

  it("devolve null sem historico nenhum", () => {
    expect(sugerirObra([], [obraA, obraB])).toBeNull();
  });

  it("dá boost a uma obra ativa quando o score fica próximo do threshold", () => {
    const obraInativa: Obra = { id: "obra-c", nome: "Obra C", ativa: false };
    const historico = [
      despesaHistorico(obraInativa.id, 1), despesaHistorico(obraInativa.id, 40),
      despesaHistorico(obraA.id, 2),
    ];
    const sugestao = sugerirObra(historico, [obraA]); // só obraA está ativa/candidata
    expect(sugestao?.obraId).toBe(obraA.id);
  });
});
```

- [ ] **Step 2: Correr e confirmar FAIL (módulo ainda não existe)**

Run: `npm run test -w server -- sugerir-obra.test.ts`
Expected: FAIL — `Cannot find module './sugerir-obra.js'`.

- [ ] **Step 3: Implementar `server/src/sugestao/sugerir-obra.ts`**

```ts
import type { Despesa, Obra } from "../repos/types.js";

export interface SugestaoObra {
  obraId: string;
  motivo: string;
  score: number;
}

const MEIA_VIDA_DIAS = 60; // peso do histórico cai para metade a cada 60 dias
const BOOST_OBRA_ATIVA = 0.15;

function pesoPorRecencia(criadaEm: Date, agora: Date): number {
  const diasAtras = (agora.getTime() - criadaEm.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, diasAtras / MEIA_VIDA_DIAS);
}

/**
 * Heurística explicável: pondera o histórico do fornecedor por recência,
 * dá um boost a obras ativas, e só sugere acima do threshold — abaixo
 * disso devolve null porque o custo de sugerir mal (contaminar o total
 * da obra em silêncio) é maior que o de não sugerir (custa uma tecla).
 */
export function sugerirObra(
  historico: Despesa[],
  obrasAtivas: Obra[],
  scoreMin = 0.6,
  agora: Date = new Date()
): SugestaoObra | null {
  if (historico.length === 0) return null;

  const ativasIds = new Set(obrasAtivas.map((o) => o.id));
  const pesos = new Map<string, number>();
  let pesoTotal = 0;

  for (const d of historico) {
    if (!d.obraId) continue;
    const peso = pesoPorRecencia(d.criadaEm, agora);
    pesos.set(d.obraId, (pesos.get(d.obraId) ?? 0) + peso);
    pesoTotal += peso;
  }
  if (pesoTotal === 0) return null;

  let melhorObraId: string | null = null;
  let melhorScore = 0;
  for (const [obraId, peso] of pesos) {
    let score = peso / pesoTotal;
    if (ativasIds.has(obraId)) score += BOOST_OBRA_ATIVA;
    if (score > melhorScore) { melhorScore = score; melhorObraId = obraId; }
  }
  if (!melhorObraId || melhorScore < scoreMin) return null;

  const ultimas = [...historico]
    .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime())
    .slice(0, 4);
  const nUltimas = ultimas.filter((d) => d.obraId === melhorObraId).length;

  return {
    obraId: melhorObraId,
    score: Math.min(melhorScore, 1),
    motivo: `${nUltimas} das últimas ${ultimas.length} faturas deste fornecedor foram para esta obra`,
  };
}
```

- [ ] **Step 4: Correr e confirmar PASS**

Run: `npm run test -w server -- sugerir-obra.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add server/src/sugestao
git commit -m "feat: heuristica de sugestao de obra com motivo explicavel e threshold 0.6"
```

---

### Task 5: Pipeline de extração (`shared/extraction`)

**Files:**
- Create: `shared/extraction/qr-fatura.ts` (copiado de `~/Downloads/qr-fatura.ts` — conteúdo já validado, ver nota abaixo)
- Create: `shared/extraction/qr-fatura.test.ts`
- Create: `shared/extraction/types.ts`
- Create: `shared/extraction/extrair-fatura.ts`
- Create: `shared/extraction/extrair-fatura.test.ts`

**Interfaces:**
- Produces: `extrairFatura(ficheiro: ArrayBuffer, adaptadores: Adaptadores): Promise<ResultadoExtracao>`, consumida por `ctx.extrair` no `context.ts` da Task 6.

- [ ] **Step 1: Copiar `qr-fatura.ts` para `shared/extraction/qr-fatura.ts`**

Run: `cp ~/Downloads/qr-fatura.ts shared/extraction/qr-fatura.ts`

Ajustar só o export final `qrParaDespesa` para nomes camelCase (consistentes com o resto do domínio — o protótipo original usa `nif_fornecedor` no exemplo em comentário, o resto do código já é camelCase):

```ts
// no fim de shared/extraction/qr-fatura.ts, substituir a função qrParaDespesa por:
export function qrParaDespesa(qr: string) {
  const f = descodificarQR(qr);
  return {
    nifFornecedor: f.nifEmitente,
    numeroFatura: f.idDocumento,
    dataFatura: f.dataDocumento,
    baseTributavel: somaBases(f).toFixed(2),
    valorIva: somaIVA(f).toFixed(2),
    valorTotal: Number(f.totalDocumento).toFixed(2),
    nifValido: nifValido(f.nifEmitente ?? ""),
  };
}
```

- [ ] **Step 2: Escrever `shared/extraction/qr-fatura.test.ts` com o exemplo real do comentário do ficheiro**

```ts
import { describe, it, expect } from "vitest";
import { descodificarQR, nifValido, qrParaDespesa } from "./qr-fatura.js";

const QR_EXEMPLO =
  "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:JF5FZZJM-118388419*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:iP3C*R:2842*S:TB;PT50001000006336966000130;25.95";

describe("descodificarQR", () => {
  it("descodifica os campos fiscais do exemplo real", () => {
    const f = descodificarQR(QR_EXEMPLO);
    expect(f.nifEmitente).toBe("502544180");
    expect(f.dataDocumento).toBe("2026-07-25");
    expect(f.totalDocumento).toBe(25.95);
    expect(f.tipoDocumentoDescr).toBe("Fatura");
  });
});

describe("nifValido", () => {
  it("aceita um NIF com checksum correto", () => {
    expect(nifValido("502544180")).toBe(true);
  });
  it("rejeita um NIF com checksum errado", () => {
    expect(nifValido("502544181")).toBe(false);
  });
  it("rejeita strings que não são 9 dígitos", () => {
    expect(nifValido("abc")).toBe(false);
  });
});

describe("qrParaDespesa", () => {
  it("mapeia o QR para os campos da despesa em camelCase", () => {
    const despesa = qrParaDespesa(QR_EXEMPLO);
    expect(despesa).toEqual({
      nifFornecedor: "502544180",
      numeroFatura: "FT 101/118388419",
      dataFatura: "2026-07-25",
      baseTributavel: "21.09",
      valorIva: "4.86",
      valorTotal: "25.95",
      nifValido: true,
    });
  });
});
```

- [ ] **Step 3: Correr e confirmar PASS**

Run: `npm run test -w shared -- qr-fatura.test.ts`
Expected: PASS (5/5). Se `qrParaDespesa` falhar por causa da edição do Step 1, corrigir os nomes de campo até bater certo.

- [ ] **Step 4: Definir tipos e portas de adaptador em `shared/extraction/types.ts`**

```ts
export interface ResultadoExtracao {
  fonte: "qr" | "visao";
  qrRaw: string | null;
  nifFornecedor: string;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string;
  valorIva: string;
  valorTotal: string;
  nifValido: boolean;
}

/** Rasteriza um PDF/imagem para pixels RGBA por página — implementação varia entre browser e Node. */
export interface RasterizadorAdapter {
  rasterizar(ficheiro: ArrayBuffer, mime: string): Promise<ImageData[]>;
}

/** Fallback quando não há QR legível — chama um modelo de visão (Claude/GPT-4o). */
export interface VisaoAdapter {
  extrairDeImagem(imagem: ImageData): Promise<Omit<ResultadoExtracao, "fonte" | "qrRaw" | "nifValido">>;
}

export interface Adaptadores {
  rasterizador: RasterizadorAdapter;
  visao: VisaoAdapter;
}
```

- [ ] **Step 5: Escrever o teste do pipeline QR-first + fallback antes do código**

```ts
// shared/extraction/extrair-fatura.test.ts
import { describe, it, expect, vi } from "vitest";
import { extrairFatura } from "./extrair-fatura.js";
import type { Adaptadores } from "./types.js";

const QR_EXEMPLO =
  "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:JF5FZZJM-118388419*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:iP3C*R:2842*S:TB;PT50001000006336966000130;25.95";

function adaptadoresFalsos(qrDetectado: string | null): Adaptadores {
  return {
    rasterizador: { rasterizar: vi.fn().async: undefined as any } as any, // substituído abaixo por mock simples
    visao: { extrairDeImagem: vi.fn() } as any,
  };
}

describe("extrairFatura", () => {
  it("usa o QR quando é legível — não chama o fallback de visão", async () => {
    const imagemFalsa = {} as ImageData;
    const adaptadores: Adaptadores = {
      rasterizador: { rasterizar: vi.fn().mockResolvedValue([imagemFalsa]) },
      visao: { extrairDeImagem: vi.fn() },
    };
    // ler-QR é injetado como 4º parâmetro para não depender de jsqr real no teste
    const resultado = await extrairFatura(new ArrayBuffer(0), "application/pdf", adaptadores, {
      lerQR: vi.fn().mockReturnValue(QR_EXEMPLO),
    });

    expect(resultado.fonte).toBe("qr");
    expect(resultado.nifFornecedor).toBe("502544180");
    expect(adaptadores.visao.extrairDeImagem).not.toHaveBeenCalled();
  });

  it("cai no fallback de visão quando não há QR legível", async () => {
    const imagemFalsa = {} as ImageData;
    const adaptadores: Adaptadores = {
      rasterizador: { rasterizar: vi.fn().mockResolvedValue([imagemFalsa]) },
      visao: {
        extrairDeImagem: vi.fn().mockResolvedValue({
          nifFornecedor: "502544180", numeroFatura: "FT 1", dataFatura: "2026-08-01",
          baseTributavel: "10.00", valorIva: "2.30", valorTotal: "12.30",
        }),
      },
    };
    const resultado = await extrairFatura(new ArrayBuffer(0), "application/pdf", adaptadores, {
      lerQR: vi.fn().mockReturnValue(null),
    });

    expect(resultado.fonte).toBe("visao");
    expect(resultado.qrRaw).toBeNull();
    expect(adaptadores.visao.extrairDeImagem).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Correr e confirmar FAIL**

Run: `npm run test -w shared -- extrair-fatura.test.ts`
Expected: FAIL — módulo `extrair-fatura.js` não existe.

- [ ] **Step 7: Implementar `shared/extraction/extrair-fatura.ts`**

```ts
import { qrParaDespesa, nifValido } from "./qr-fatura.js";
import type { Adaptadores, ResultadoExtracao } from "./types.js";

interface Overrides {
  /** Injetado nos testes; em produção chama jsqr sobre os pixels rasterizados. */
  lerQR?: (imagem: ImageData) => string | null;
}

export async function extrairFatura(
  ficheiro: ArrayBuffer,
  mime: string,
  adaptadores: Adaptadores,
  overrides: Overrides = {}
): Promise<ResultadoExtracao> {
  const paginas = await adaptadores.rasterizador.rasterizar(ficheiro, mime);
  const lerQR = overrides.lerQR ?? lerQRComJsqr;

  for (const pagina of paginas) {
    const qrRaw = lerQR(pagina);
    if (qrRaw) {
      const dados = qrParaDespesa(qrRaw);
      return { fonte: "qr", qrRaw, ...dados };
    }
  }

  // Nem todos os PDFs têm QR (recibos manuais, digitalizações) — fallback de visão.
  const dados = await adaptadores.visao.extrairDeImagem(paginas[0]);
  return {
    fonte: "visao",
    qrRaw: null,
    ...dados,
    nifValido: nifValido(dados.nifFornecedor),
  };
}

function lerQRComJsqr(imagem: ImageData): string | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jsQR = require("jsqr").default ?? require("jsqr");
  const resultado = jsQR(imagem.data, imagem.width, imagem.height);
  return resultado?.data ?? null;
}
```

- [ ] **Step 8: Corrigir o teste (o `adaptadoresFalsos` do Step 5 tem uma gralha de sintaxe — remover, os dois `it` já constroem os adaptadores inline)**

Apagar a função `adaptadoresFalsos` não utilizada do ficheiro de teste antes de correr.

- [ ] **Step 9: Correr e confirmar PASS**

Run: `npm run test -w shared -- extrair-fatura.test.ts`
Expected: PASS (2/2).

- [ ] **Step 10: Commit**

```bash
git add shared/extraction
git commit -m "feat: pipeline de extracao QR-first com fallback de visao"
```

---

### Task 6: GraphQL — schema, resolvers, DataLoader, Apollo Server

**Files:**
- Create: `server/schema.graphql`
- Create: `server/src/loaders/index.ts`
- Create: `server/src/context.ts`
- Create: `server/src/resolvers.ts`
- Create: `server/src/resolvers.test.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `Repos` (Task 3), `sugerirObra` (Task 4), `extrairFatura` (Task 5).
- Produces: servidor GraphQL a correr em `http://localhost:4000/graphql`, consumido pelo `web` na Task 7.

- [ ] **Step 1: Escrever `server/schema.graphql`**

```graphql
enum EstadoDespesa { POR_REVER CONFIRMADA ADIADA }
enum OrigemDespesa { UPLOAD EMAIL }

type Obra {
  id: ID!
  nome: String!
  ativa: Boolean!
}

type Fornecedor {
  id: ID!
  nif: String!
  nome: String
}

type Despesa {
  id: ID!
  nifFornecedor: String!
  fornecedor: Fornecedor
  numeroFatura: String!
  dataFatura: String!
  baseTributavel: String!
  valorIva: String!
  valorTotal: String!
  ficheiroUrl: String!
  qrRaw: String
  origem: OrigemDespesa!
  obra: Obra
  estado: EstadoDespesa!
  lockPorId: String
  lockExpiraEm: String
}

type SugestaoObra {
  obraId: ID!
  motivo: String!
  score: Float!
}

type TotalObra {
  obra: Obra!
  total: String!
}

type IngerirFaturaResultado {
  despesa: Despesa!
  duplicada: Boolean!
}

input AtualizarValoresInput {
  baseTributavel: String
  valorIva: String
  valorTotal: String
}

type Query {
  filaRevisao(estado: EstadoDespesa): [Despesa!]!
  sugestaoObra(despesaId: ID!): SugestaoObra
  totaisPorObra: [TotalObra!]!
  obras: [Obra!]!
}

type Mutation {
  ingerirFatura(ficheiroUrl: String!, qrRaw: String): IngerirFaturaResultado!
  bloquear(despesaId: ID!, utilizadorId: ID!): Despesa!
  atribuirObra(despesaId: ID!, obraId: ID!): Despesa!
  atualizarValores(despesaId: ID!, input: AtualizarValoresInput!): Despesa!
  confirmar(despesaId: ID!): Despesa!
  adiar(despesaId: ID!): Despesa!
}
```

- [ ] **Step 2: DataLoaders em `server/src/loaders/index.ts` (evitar N+1 de `Despesa.fornecedor`/`Despesa.obra`)**

```ts
import DataLoader from "dataloader";
import type { Repos } from "../repos/types.js";

export function criarLoaders(repos: Repos) {
  return {
    obraPorId: new DataLoader(async (ids: readonly string[]) => {
      const resultados = await Promise.all(ids.map((id) => repos.obras.obterPorId(id)));
      return resultados;
    }),
    fornecedorPorNif: new DataLoader(async (nifs: readonly string[]) => {
      const resultados = await Promise.all(nifs.map((nif) => repos.fornecedores.obterPorNif(nif)));
      return resultados;
    }),
  };
}

export type Loaders = ReturnType<typeof criarLoaders>;
```

- [ ] **Step 3: `server/src/context.ts` — monta `ctx.repos`, `ctx.loaders`, `ctx.extrair`**

```ts
import type { Repos } from "./repos/types.js";
import { criarLoaders, type Loaders } from "./loaders/index.js";
import { extrairFatura } from "@prumo/shared";
import type { Adaptadores, ResultadoExtracao } from "@prumo/shared";

export interface GraphQLContext {
  repos: Repos;
  loaders: Loaders;
  extrair: (ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>;
}

export function criarContexto(repos: Repos, adaptadores: Adaptadores): GraphQLContext {
  return {
    repos,
    loaders: criarLoaders(repos),
    extrair: (ficheiro, mime) => extrairFatura(ficheiro, mime, adaptadores),
  };
}
```

- [ ] **Step 4: Escrever `server/src/resolvers.test.ts` primeiro — cobre o fluxo ponta-a-ponta com o repo em memória**

```ts
import { describe, it, expect } from "vitest";
import { resolvers } from "./resolvers.js";
import { criarReposMemoria } from "./repos/memoria.js";
import { criarLoaders } from "./loaders/index.js";

function ctxDeTeste(seedObras: { nome: string; ativa: boolean }[] = []) {
  const repos = criarReposMemoria(seedObras);
  return { repos, loaders: criarLoaders(repos), extrair: async () => { throw new Error("não usado neste teste"); } };
}

describe("Mutation.ingerirFatura", () => {
  const qrRaw =
    "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:x*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:x*R:1*S:x";

  it("cria uma despesa POR_REVER a partir do QR e não marca como duplicada da primeira vez", async () => {
    const ctx = ctxDeTeste();
    const resultado = await resolvers.Mutation.ingerirFatura(
      {}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx
    );
    expect(resultado.duplicada).toBe(false);
    expect(resultado.despesa.estado).toBe("POR_REVER");
    expect(resultado.despesa.nifFornecedor).toBe("502544180");
  });

  it("devolve duplicada:true na segunda ingestão da mesma chave, sem criar outra despesa", async () => {
    const ctx = ctxDeTeste();
    await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx);
    const segunda = await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f2.pdf", qrRaw }, ctx);
    expect(segunda.duplicada).toBe(true);
    const fila = await ctx.repos.despesas.listarFila();
    expect(fila).toHaveLength(1);
  });
});

describe("fluxo de revisão ponta-a-ponta", () => {
  it("bloquear -> atribuirObra -> confirmar reflete-se em totaisPorObra", async () => {
    const ctx = ctxDeTeste([{ nome: "Obra Norte", ativa: true }]);
    const [obra] = await ctx.repos.obras.listar();
    const { despesa } = await resolvers.Mutation.ingerirFatura(
      {}, { ficheiroUrl: "https://x/f.pdf", qrRaw: "A:502544180*D:FT*F:20260725*G:FT1*O:25.95" }, ctx
    );

    await resolvers.Mutation.bloquear({}, { despesaId: despesa.id, utilizadorId: "user-1" }, ctx);
    await resolvers.Mutation.atribuirObra({}, { despesaId: despesa.id, obraId: obra.id }, ctx);
    const confirmada = await resolvers.Mutation.confirmar({}, { despesaId: despesa.id }, ctx);
    expect(confirmada.estado).toBe("CONFIRMADA");

    const totais = await resolvers.Query.totaisPorObra({}, {}, ctx);
    expect(totais).toEqual([{ obra, total: "25.95" }]);
  });
});
```

- [ ] **Step 5: Correr e confirmar FAIL**

Run: `npm run test -w server -- resolvers.test.ts`
Expected: FAIL — `resolvers.js` não existe ainda.

- [ ] **Step 6: Implementar `server/src/resolvers.ts`**

```ts
import type { GraphQLContext } from "./context.js";
import { qrParaDespesa } from "@prumo/shared";
import { sugerirObra } from "./sugestao/sugerir-obra.js";
import type { EstadoDespesa } from "./repos/types.js";

export const resolvers = {
  Query: {
    filaRevisao: (_: unknown, args: { estado?: EstadoDespesa }, ctx: GraphQLContext) =>
      ctx.repos.despesas.listarFila(args.estado),

    sugestaoObra: async (_: unknown, args: { despesaId: string }, ctx: GraphQLContext) => {
      const despesa = await ctx.repos.despesas.obterPorId(args.despesaId);
      if (!despesa) return null;
      const [historico, obrasAtivas] = await Promise.all([
        ctx.repos.fornecedores.historico(despesa.nifFornecedor, 10),
        ctx.repos.obras.ativas(),
      ]);
      return sugerirObra(historico, obrasAtivas);
    },

    totaisPorObra: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const totais = await ctx.repos.despesas.totaisPorObra();
      const obras = await Promise.all(totais.map((t) => ctx.loaders.obraPorId.load(t.obraId)));
      return totais.map((t, i) => ({ obra: obras[i]!, total: t.total }));
    },

    obras: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.obras.listar(),
  },

  Mutation: {
    ingerirFatura: async (
      _: unknown, args: { ficheiroUrl: string; qrRaw?: string | null }, ctx: GraphQLContext
    ) => {
      if (!args.qrRaw) throw new Error("Fallback de visão ainda não ligado ao resolver — usar ctx.extrair (Fase 2)");
      const dados = qrParaDespesa(args.qrRaw);

      const existente = await ctx.repos.despesas.obterPorChaveDedup(
        dados.nifFornecedor, dados.numeroFatura, dados.dataFatura
      );
      if (existente) return { despesa: existente, duplicada: true };

      await ctx.repos.fornecedores.upsert(dados.nifFornecedor);
      const despesa = await ctx.repos.despesas.criar({
        ...dados, ficheiroUrl: args.ficheiroUrl, qrRaw: args.qrRaw, origem: "UPLOAD",
      });
      return { despesa, duplicada: false };
    },

    bloquear: (_: unknown, args: { despesaId: string; utilizadorId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.bloquear(args.despesaId, args.utilizadorId),

    atribuirObra: (_: unknown, args: { despesaId: string; obraId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.atribuirObra(args.despesaId, args.obraId),

    atualizarValores: (
      _: unknown, args: { despesaId: string; input: Record<string, string> }, ctx: GraphQLContext
    ) => ctx.repos.despesas.atualizarValores(args.despesaId, args.input),

    confirmar: (_: unknown, args: { despesaId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.confirmar(args.despesaId),

    adiar: (_: unknown, args: { despesaId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.adiar(args.despesaId),
  },

  Despesa: {
    fornecedor: (despesa: { nifFornecedor: string }, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.fornecedorPorNif.load(despesa.nifFornecedor),
    obra: (despesa: { obraId: string | null }, _: unknown, ctx: GraphQLContext) =>
      despesa.obraId ? ctx.loaders.obraPorId.load(despesa.obraId) : null,
  },
};
```

- [ ] **Step 7: Correr e confirmar PASS**

Run: `npm run test -w server -- resolvers.test.ts`
Expected: PASS (3/3). Nota: `ingerirFatura` lança erro explícito se não vier `qrRaw` — o fallback de visão liga-se ao `ctx.extrair` numa fase seguinte (fora do MVP-núcleo), fica documentado no código para não fingir suporte que ainda não existe.

- [ ] **Step 8: Bootstrap do servidor em `server/src/index.ts`**

```ts
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolvers } from "./resolvers.js";
import { criarReposPrisma } from "./repos/prisma.js";
import { criarContexto } from "./context.js";

const typeDefs = readFileSync(new URL("../schema.graphql", import.meta.url), "utf-8");
const prisma = new PrismaClient();
const repos = criarReposPrisma(prisma);

// Adaptadores de extração ainda não ligados aqui — ver Task 5/Fase 2 (email/visão em Node).
const contexto = criarContexto(repos, {
  rasterizador: { rasterizar: async () => { throw new Error("rasterizador Node não implementado no MVP-núcleo"); } },
  visao: { extrairDeImagem: async () => { throw new Error("visão Node não implementada no MVP-núcleo"); } },
});

const app = express();
const apollo = new ApolloServer({ typeDefs, resolvers });
await apollo.start();
app.use("/graphql", express.json(), expressMiddleware(apollo, { context: async () => contexto }));

app.listen(4000, () => console.log("GraphQL em http://localhost:4000/graphql"));
```

- [ ] **Step 9: Arrancar e confirmar manualmente**

Run: `npm run dev:server`
Expected: log `GraphQL em http://localhost:4000/graphql`; um `POST /graphql` com `{ "query": "{ obras { id nome } }" }` devolve `[]` sem erro.

- [ ] **Step 10: Commit**

```bash
git add server/schema.graphql server/src/loaders server/src/context.ts server/src/resolvers.ts server/src/resolvers.test.ts server/src/index.ts
git commit -m "feat: schema graphql, resolvers, dataloaders e bootstrap do apollo server"
```

---

### Task 7: Web — Apollo Client + `FilaRevisao.tsx`

**Files:**
- Create: `web/src/apollo.ts`
- Create: `web/src/graphql.ts`
- Create: `web/src/FilaRevisao.tsx`
- Create: `web/src/FilaRevisao.test.tsx`
- Create: `web/src/setupTests.ts`
- Modify: `web/src/App.tsx`, `web/src/main.tsx`

**Interfaces:**
- Consumes: `Query.filaRevisao`, `Query.sugestaoObra`, `Query.obras`, `Mutation.atribuirObra`, `Mutation.confirmar`, `Mutation.adiar` do schema da Task 6.

- [ ] **Step 1: `web/src/apollo.ts`**

```ts
import { ApolloClient, InMemoryCache } from "@apollo/client";

export const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  cache: new InMemoryCache(),
});
```

- [ ] **Step 2: `web/src/graphql.ts` — queries e mutations tipadas**

```ts
import { gql } from "@apollo/client";

export const FILA_REVISAO = gql`
  query FilaRevisao {
    filaRevisao(estado: POR_REVER) {
      id
      nifFornecedor
      fornecedor { nome }
      numeroFatura
      dataFatura
      valorTotal
      estado
    }
  }
`;

export const SUGESTAO_OBRA = gql`
  query SugestaoObra($despesaId: ID!) {
    sugestaoObra(despesaId: $despesaId) { obraId motivo score }
  }
`;

export const OBRAS = gql`
  query Obras { obras { id nome } }
`;

export const ATRIBUIR_OBRA = gql`
  mutation AtribuirObra($despesaId: ID!, $obraId: ID!) {
    atribuirObra(despesaId: $despesaId, obraId: $obraId) { id obra { id nome } }
  }
`;

export const CONFIRMAR = gql`
  mutation Confirmar($despesaId: ID!) {
    confirmar(despesaId: $despesaId) { id estado }
  }
`;

export const ADIAR = gql`
  mutation Adiar($despesaId: ID!) {
    adiar(despesaId: $despesaId) { id estado }
  }
`;
```

- [ ] **Step 3: `web/src/setupTests.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

E em `web/vite.config.ts`, adicionar bloco `test`:

```ts
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./src/setupTests.ts", globals: true },
});
```

Run: `npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom -w web`

- [ ] **Step 4: Escrever `web/src/FilaRevisao.test.tsx` primeiro**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing";
import { FilaRevisao } from "./FilaRevisao.js";
import { FILA_REVISAO, SUGESTAO_OBRA, OBRAS, ATRIBUIR_OBRA, CONFIRMAR } from "./graphql.js";

const despesaMock = {
  id: "d1", nifFornecedor: "502544180", fornecedor: { nome: "Fornecedor X" },
  numeroFatura: "FT 1", dataFatura: "2026-08-01", valorTotal: "25.95", estado: "POR_REVER",
};

const mocks = [
  { request: { query: FILA_REVISAO }, result: { data: { filaRevisao: [despesaMock] } } },
  { request: { query: OBRAS }, result: { data: { obras: [{ id: "o1", nome: "Obra Norte" }] } } },
  {
    request: { query: SUGESTAO_OBRA, variables: { despesaId: "d1" } },
    result: { data: { sugestaoObra: { obraId: "o1", motivo: "3 das últimas 4 faturas deste fornecedor", score: 0.8 } } },
  },
  {
    request: { query: ATRIBUIR_OBRA, variables: { despesaId: "d1", obraId: "o1" } },
    result: { data: { atribuirObra: { id: "d1", obra: { id: "o1", nome: "Obra Norte" } } } },
  },
  {
    request: { query: CONFIRMAR, variables: { despesaId: "d1" } },
    result: { data: { confirmar: { id: "d1", estado: "CONFIRMADA" } } },
  },
];

describe("FilaRevisao", () => {
  it("mostra a despesa e a sugestão pré-preenchida com o motivo visível", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <FilaRevisao />
      </MockedProvider>
    );
    expect(await screen.findByText("Fornecedor X")).toBeInTheDocument();
    expect(await screen.findByText(/3 das últimas 4 faturas deste fornecedor/)).toBeInTheDocument();
  });

  it("confirmar com a obra sugerida remove o cartão da fila (tecla Enter)", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <FilaRevisao />
      </MockedProvider>
    );
    await screen.findByText("Fornecedor X");
    await user.keyboard("{Enter}");
    expect(screen.queryByText("Fornecedor X")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Correr e confirmar FAIL**

Run: `npm run test -w web -- FilaRevisao.test.tsx`
Expected: FAIL — `FilaRevisao.js` não existe.

- [ ] **Step 6: Implementar `web/src/FilaRevisao.tsx` — keyboard-first, sugestão pré-preenchida, motivo sempre visível**

```tsx
import { useQuery, useMutation } from "@apollo/client";
import { useEffect, useState } from "react";
import { FILA_REVISAO, SUGESTAO_OBRA, OBRAS, ATRIBUIR_OBRA, CONFIRMAR, ADIAR } from "./graphql.js";

export function FilaRevisao() {
  const { data, refetch } = useQuery(FILA_REVISAO);
  const { data: obrasData } = useQuery(OBRAS);
  const [atribuirObra] = useMutation(ATRIBUIR_OBRA);
  const [confirmar] = useMutation(CONFIRMAR);
  const [adiar] = useMutation(ADIAR);

  const fila = data?.filaRevisao ?? [];
  const atual = fila[0];

  const { data: sugestaoData } = useQuery(SUGESTAO_OBRA, {
    variables: { despesaId: atual?.id },
    skip: !atual,
  });
  const sugestao = sugestaoData?.sugestaoObra ?? null;

  const [obraEscolhidaId, setObraEscolhidaId] = useState<string | null>(null);
  useEffect(() => { setObraEscolhidaId(sugestao?.obraId ?? null); }, [sugestao, atual?.id]);

  async function confirmarAtual() {
    if (!atual || !obraEscolhidaId) return;
    await atribuirObra({ variables: { despesaId: atual.id, obraId: obraEscolhidaId } });
    await confirmar({ variables: { despesaId: atual.id } });
    await refetch();
  }

  async function adiarAtual() {
    if (!atual) return;
    await adiar({ variables: { despesaId: atual.id } });
    await refetch();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") confirmarAtual();
      if (e.key === "Escape") adiarAtual();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!atual) return <p>Fila de revisão vazia.</p>;

  return (
    <div>
      <p>{atual.fornecedor?.nome ?? atual.nifFornecedor}</p>
      <p>{atual.numeroFatura} — {atual.dataFatura} — {atual.valorTotal}€</p>

      <label>
        Obra
        <select value={obraEscolhidaId ?? ""} onChange={(e) => setObraEscolhidaId(e.target.value || null)}>
          <option value="">— escolher —</option>
          {(obrasData?.obras ?? []).map((o: { id: string; nome: string }) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
      </label>

      {sugestao && <p>Sugestão: {sugestao.motivo} (score {sugestao.score.toFixed(2)})</p>}

      <button onClick={confirmarAtual} disabled={!obraEscolhidaId}>Confirmar (Enter)</button>
      <button onClick={adiarAtual}>Adiar (Esc)</button>
    </div>
  );
}
```

- [ ] **Step 7: Correr e confirmar PASS**

Run: `npm run test -w web -- FilaRevisao.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 8: Ligar ao `App.tsx`/`main.tsx`**

```tsx
// web/src/App.tsx
import { ApolloProvider } from "@apollo/client";
import { client } from "./apollo.js";
import { FilaRevisao } from "./FilaRevisao.js";

export function App() {
  return (
    <ApolloProvider client={client}>
      <FilaRevisao />
    </ApolloProvider>
  );
}
```

- [ ] **Step 9: Confirmar manualmente no browser**

Run: `npm run dev:server` (noutro terminal) e `npm run dev:web`
Expected: com `npm run dev:server` a correr e pelo menos uma `Obra` criada via `prisma studio` ou uma mutation manual, abrir `http://localhost:5173` mostra "Fila de revisão vazia." (fila vazia é o estado correto sem dados semeados — usar Task 8 seguinte, fora deste plano, para semear dados via `ingerirFatura`).

- [ ] **Step 10: Commit**

```bash
git add web/src
git commit -m "feat: FilaRevisao keyboard-first com sugestao pre-preenchida e motivo visivel"
```

---

## Self-Review

**Cobertura da spec (secção 9 do CLAUDE.md, itens 1–6):**
1. Scaffold ✅ Task 1.
2. Prisma schema com dedup + índice ✅ Task 2.
3. `Repos` com Prisma, somatórios em SQL ✅ Task 3.
4. `ctx.extrair` ligado (QR client-side já cablado no resolver via `qrParaDespesa`; adaptador Node/email fica fora deste plano — ver Fases seguintes) ⚠️ parcial, documentado explicitamente no código (Task 6, Step 8) em vez de fingido.
5. DataLoader nos field resolvers (`Despesa.fornecedor`, `Despesa.obra`) ✅ Task 6.
6. Port da UI da fila de revisão ✅ Task 7 (escrita de raiz, não portada — protótipo não encontrado, ver nota na secção File Structure).

**Decisões de design (secção 6) cobertas:** Decimal/NUMERIC nunca Float (Global Constraints + `memoria.ts` com aviso explícito) · dedup por chave composta (Task 2/3/6) · lock TTL 5 min (Task 3) · original imutável (`AtualizarValoresInput` nunca inclui `ficheiroUrl`/`qrRaw`) · sugestão com motivo e threshold 0.6 (Task 4) · obra como FK controlada (schema Prisma + GraphQL) · human-in-the-loop com motivo sempre visível (Task 7).

**Fora deste plano — próximos planos separados (backlog itens 7–10 do CLAUDE.md):**
- **Fase 2 — Ingestão real:** upload + storage S3/R2, captura mobile, adaptador Node do pipeline de extração (rasterizador + visão), ingestão por email (`faturas@empresa.pt`).
- **Fase 3 — Colaboração em tempo real:** Subscriptions GraphQL para a fila atualizar entre os dois revisores.
- **Fase 4 — Adoção:** export CSV/Excel dos confirmados.
- **Fase 5 — Endurecimento:** testes de carga do lock TTL sob concorrência real, papéis/autenticação de utilizador (hoje `utilizadorId` é passado às cegas pelo cliente).

Cada uma cobre um subsistema independente com deliverable próprio testável — para não sobrecarregar este documento, escrevo-as como planos separados quando quiseres avançar para lá.
