import { randomUUID } from "node:crypto";
import type {
  Repos, CentroCusto, Fornecedor, Utilizador, Tarefa, Funcionalidade, Configuracao, Despesa, CriarDespesaInput,
  AtualizarValoresInput, TotalCentroCusto, DespesasFiltro,
  CriarCentroCustoInput, AtualizarCentroCustoInput,
  CriarFornecedorInput, AtualizarFornecedorInput,
  CriarUtilizadorInput, AtualizarUtilizadorInput,
  CriarTarefaInput, AtualizarTarefaInput,
} from "./types.js";
import { lockAtivoDeOutro, LOCK_TTL_MS, ERRO_CENTRO_CUSTO_EM_USO, ERRO_FORNECEDOR_EM_USO } from "./types.js";

/** Impl. em memória para testes de resolvers. Usa `number` só por conveniência — NUNCA copiar isto para o impl. Prisma (ver CLAUDE.md decisão #1). */
export function criarReposMemoria(seedCentrosCusto: Omit<CentroCusto, "id">[] = []): Repos {
  const centrosCusto = new Map<string, CentroCusto>();
  const fornecedores = new Map<string, Fornecedor>();
  const utilizadores = new Map<string, Utilizador>();
  const tarefas = new Map<string, Tarefa>();
  const funcionalidades = new Map<string, Funcionalidade>();
  const configuracoes = new Map<string, Configuracao>();
  const despesas = new Map<string, Despesa>();

  for (const c of seedCentrosCusto) {
    const id = randomUUID();
    centrosCusto.set(id, { ...c, id });
  }

  function encontrarPorDedup(nif: string, numero: string, data: string) {
    return [...despesas.values()].find(
      (d) => d.nifFornecedor === nif && d.numeroFatura === numero && d.dataFatura === data
    );
  }

  function centroCustoEmUso(centroCustoId: string) {
    return [...despesas.values()].some((d) => d.centroCustoId === centroCustoId);
  }

  function fornecedorEmUso(fornecedorId: string) {
    return [...despesas.values()].some((d) => d.fornecedorId === fornecedorId);
  }

  return {
    centrosCusto: {
      async listar() { return [...centrosCusto.values()]; },
      async ativas() { return [...centrosCusto.values()].filter((c) => c.ativa); },
      async obterPorId(id) { return centrosCusto.get(id) ?? null; },
      async criar(input: CriarCentroCustoInput) {
        if ([...centrosCusto.values()].some((c) => c.nome === input.nome)) {
          throw new Error(`Já existe um centro de custo com o nome "${input.nome}"`);
        }
        const id = randomUUID();
        const centroCusto: CentroCusto = { id, nome: input.nome, ativa: input.ativa ?? true };
        centrosCusto.set(id, centroCusto);
        return centroCusto;
      },
      async atualizar(id, patch: AtualizarCentroCustoInput) {
        const centroCusto = centrosCusto.get(id);
        if (!centroCusto) throw new Error(`Centro de custo ${id} não encontrado`);
        if (patch.nome && patch.nome !== centroCusto.nome) {
          if ([...centrosCusto.values()].some((c) => c.id !== id && c.nome === patch.nome)) {
            throw new Error(`Já existe um centro de custo com o nome "${patch.nome}"`);
          }
        }
        Object.assign(centroCusto, patch);
        return centroCusto;
      },
      async eliminar(id) {
        if (!centrosCusto.has(id)) throw new Error(`Centro de custo ${id} não encontrado`);
        if (centroCustoEmUso(id)) throw new Error(ERRO_CENTRO_CUSTO_EM_USO);
        centrosCusto.delete(id);
      },
    },
    fornecedores: {
      async listar() { return [...fornecedores.values()]; },
      async obterPorNif(nif) {
        return [...fornecedores.values()].find((f) => f.nif === nif) ?? null;
      },
      async upsert(nif, dados) {
        const existente = [...fornecedores.values()].find((f) => f.nif === nif);
        if (existente) {
          if (!existente.nome && dados?.nome) existente.nome = dados.nome;
          if (!existente.morada && dados?.morada) existente.morada = dados.morada;
          return existente;
        }
        const id = randomUUID();
        const f: Fornecedor = { id, nif, nome: dados?.nome ?? null, morada: dados?.morada ?? null };
        fornecedores.set(id, f);
        return f;
      },
      async criar(input: CriarFornecedorInput) {
        if ([...fornecedores.values()].some((f) => f.nif === input.nif)) {
          throw new Error(`Já existe um fornecedor com o NIF "${input.nif}"`);
        }
        const id = randomUUID();
        const f: Fornecedor = {
          id, nif: input.nif, nome: input.nome ?? null, morada: input.morada ?? null,
        };
        fornecedores.set(id, f);
        return f;
      },
      async atualizar(id, patch: AtualizarFornecedorInput) {
        const f = fornecedores.get(id);
        if (!f) throw new Error(`Fornecedor ${id} não encontrado`);
        if (patch.nif && patch.nif !== f.nif) {
          if ([...fornecedores.values()].some((x) => x.id !== id && x.nif === patch.nif)) {
            throw new Error(`Já existe um fornecedor com o NIF "${patch.nif}"`);
          }
        }
        Object.assign(f, patch);
        return f;
      },
      async eliminar(id) {
        if (!fornecedores.has(id)) throw new Error(`Fornecedor ${id} não encontrado`);
        if (fornecedorEmUso(id)) throw new Error(ERRO_FORNECEDOR_EM_USO);
        fornecedores.delete(id);
      },
      async historico(nif, limite) {
        return [...despesas.values()]
          .filter((d) => d.nifFornecedor === nif)
          .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime())
          .slice(0, limite);
      },
    },
    utilizadores: {
      async listar() { return [...utilizadores.values()]; },
      async obterPorId(id) { return utilizadores.get(id) ?? null; },
      async criar(input: CriarUtilizadorInput) {
        if ([...utilizadores.values()].some((u) => u.email === input.email)) {
          throw new Error(`Já existe um utilizador com o email "${input.email}"`);
        }
        const id = randomUUID();
        const u: Utilizador = { id, nome: input.nome, email: input.email };
        utilizadores.set(id, u);
        return u;
      },
      async atualizar(id, patch: AtualizarUtilizadorInput) {
        const u = utilizadores.get(id);
        if (!u) throw new Error(`Utilizador ${id} não encontrado`);
        if (patch.email && patch.email !== u.email) {
          if ([...utilizadores.values()].some((x) => x.id !== id && x.email === patch.email)) {
            throw new Error(`Já existe um utilizador com o email "${patch.email}"`);
          }
        }
        Object.assign(u, patch);
        return u;
      },
      async eliminar(id) {
        if (!utilizadores.has(id)) throw new Error(`Utilizador ${id} não encontrado`);
        utilizadores.delete(id);
      },
    },
    tarefas: {
      async listar() {
        return [...tarefas.values()].sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime());
      },
      async criar(input: CriarTarefaInput) {
        const id = randomUUID();
        const t: Tarefa = { id, texto: input.texto, feita: false, criadaEm: new Date() };
        tarefas.set(id, t);
        return t;
      },
      async atualizar(id, patch: AtualizarTarefaInput) {
        const t = tarefas.get(id);
        if (!t) throw new Error(`Tarefa ${id} não encontrada`);
        Object.assign(t, patch);
        return t;
      },
      async eliminar(id) {
        if (!tarefas.has(id)) throw new Error(`Tarefa ${id} não encontrada`);
        tarefas.delete(id);
      },
      async eliminarFeitas() {
        const feitas = [...tarefas.values()].filter((t) => t.feita);
        for (const t of feitas) tarefas.delete(t.id);
        return feitas.length;
      },
    },
    funcionalidades: {
      async listar() { return [...funcionalidades.values()]; },
      async definir(chave, nome) {
        const existente = [...funcionalidades.values()].find((f) => f.chave === chave);
        if (existente) {
          existente.nome = nome;
          return existente;
        }
        const id = randomUUID();
        const f: Funcionalidade = { id, chave, nome, ativa: false };
        funcionalidades.set(id, f);
        return f;
      },
      async atualizar(chave, ativa) {
        const f = [...funcionalidades.values()].find((x) => x.chave === chave);
        if (!f) throw new Error(`Funcionalidade "${chave}" não encontrada`);
        f.ativa = ativa;
        return f;
      },
    },
    configuracao: {
      async obter(chave) {
        return [...configuracoes.values()].find((c) => c.chave === chave)?.valor ?? null;
      },
      async garantirExiste(chave, valorDefeito) {
        const existente = [...configuracoes.values()].find((c) => c.chave === chave);
        if (existente) return existente;
        const id = randomUUID();
        const c: Configuracao = { id, chave, valor: valorDefeito };
        configuracoes.set(id, c);
        return c;
      },
      async definir(chave, valor) {
        const existente = [...configuracoes.values()].find((c) => c.chave === chave);
        if (existente) {
          existente.valor = valor;
          return existente;
        }
        const id = randomUUID();
        const c: Configuracao = { id, chave, valor };
        configuracoes.set(id, c);
        return c;
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
          fornecedorId: input.fornecedorId ?? null,
          centroCustoId: null,
          estado: "POR_REVER",
          lockPorId: null,
          lockExpiraEm: null,
          criadaEm: new Date(),
        };
        despesas.set(id, despesa);
        return despesa;
      },
      async obterPorId(id) { return despesas.get(id) ?? null; },
      async listar(filtro?: DespesasFiltro) {
        let resultado = [...despesas.values()];
        if (filtro?.estado) resultado = resultado.filter((d) => d.estado === filtro.estado);
        if (filtro?.centroCustoId) resultado = resultado.filter((d) => d.centroCustoId === filtro.centroCustoId);
        return resultado;
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
      async atribuirCentroCusto(id, centroCustoId) {
        const d = despesas.get(id);
        if (!d) throw new Error(`Despesa ${id} não encontrada`);
        d.centroCustoId = centroCustoId;
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
      async totaisPorCentroCusto(): Promise<TotalCentroCusto[]> {
        const somas = new Map<string, number>();
        for (const d of despesas.values()) {
          if (d.estado !== "CONFIRMADA" || !d.centroCustoId) continue;
          somas.set(d.centroCustoId, (somas.get(d.centroCustoId) ?? 0) + Number(d.valorTotal));
        }
        return [...somas.entries()].map(([centroCustoId, total]) => ({ centroCustoId, total: total.toFixed(2) }));
      },
    },
  };
}
