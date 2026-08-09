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
