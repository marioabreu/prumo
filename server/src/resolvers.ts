import type { GraphQLContext } from "./context.js";
import { qrParaDespesa, nifValido } from "@prumo/shared";
import { sugerirCentroCusto } from "./sugestao/sugerir-centro-custo.js";
import {
  obterRotulosCentroCusto, CHAVE_LABEL_SINGULAR, CHAVE_LABEL_PLURAL,
} from "./configuracao/rotulos.js";
import type {
  EstadoDespesa, CriarCentroCustoInput, AtualizarCentroCustoInput,
  CriarFornecedorInput, AtualizarFornecedorInput,
  CriarUtilizadorInput, AtualizarUtilizadorInput,
  CriarTarefaInput, AtualizarTarefaInput,
} from "./repos/types.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarNif(nif: string) {
  if (!nifValido(nif)) throw new Error(`NIF inválido: "${nif}"`);
}

function validarEmail(email: string) {
  if (!EMAIL_RE.test(email)) throw new Error(`Email inválido: "${email}"`);
}

export const resolvers = {
  Query: {
    filaRevisao: (_: unknown, args: { estado?: EstadoDespesa }, ctx: GraphQLContext) =>
      ctx.repos.despesas.listar({ estado: args.estado ?? "POR_REVER" }),

    despesas: (
      _: unknown, args: { estado?: EstadoDespesa; centroCustoId?: string }, ctx: GraphQLContext
    ) => ctx.repos.despesas.listar({ estado: args.estado, centroCustoId: args.centroCustoId }),

    despesa: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.obterPorId(args.id),

    sugestaoCentroCusto: async (_: unknown, args: { despesaId: string }, ctx: GraphQLContext) => {
      const despesa = await ctx.repos.despesas.obterPorId(args.despesaId);
      if (!despesa) return null;
      const [historico, centrosCustoAtivos] = await Promise.all([
        ctx.repos.fornecedores.historico(despesa.nifFornecedor, 10),
        ctx.repos.centrosCusto.ativas(),
      ]);
      return sugerirCentroCusto(historico, centrosCustoAtivos);
    },

    totaisPorCentroCusto: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const totais = await ctx.repos.despesas.totaisPorCentroCusto();
      const centrosCusto = await Promise.all(
        totais.map((t) => ctx.loaders.centroCustoPorId.load(t.centroCustoId))
      );
      return totais.map((t, i) => ({ centroCusto: centrosCusto[i]!, total: t.total }));
    },

    centrosCusto: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.centrosCusto.listar(),
    fornecedores: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.fornecedores.listar(),
    utilizadores: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.utilizadores.listar(),
    tarefas: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.tarefas.listar(),
    funcionalidades: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.funcionalidades.listar(),
    rotulosCentroCusto: (_: unknown, __: unknown, ctx: GraphQLContext) => obterRotulosCentroCusto(ctx.repos),
  },

  Mutation: {
    ingerirFatura: async (
      _: unknown, args: { ficheiroUrl: string; qrRaw?: string | null }, ctx: GraphQLContext
    ) => {
      if (!args.qrRaw) throw new Error("Fallback de visão ainda não ligado ao resolver — usar ctx.extrair (Fase 2)");
      const { nifValido: _nifValido, ...dados } = qrParaDespesa(args.qrRaw);

      const existente = await ctx.repos.despesas.obterPorChaveDedup(
        dados.nifFornecedor, dados.numeroFatura, dados.dataFatura
      );
      if (existente) return { despesa: existente, duplicada: true };

      const fornecedorExistente = await ctx.repos.fornecedores.obterPorNif(dados.nifFornecedor);
      const dadosEmpresa = fornecedorExistente?.nome ? undefined : await ctx.pesquisarEmpresa(dados.nifFornecedor);
      const fornecedor = await ctx.repos.fornecedores.upsert(dados.nifFornecedor, dadosEmpresa);
      const despesa = await ctx.repos.despesas.criar({
        ...dados, fornecedorId: fornecedor.id, ficheiroUrl: args.ficheiroUrl, qrRaw: args.qrRaw, origem: "UPLOAD",
      });
      return { despesa, duplicada: false };
    },

    bloquear: (_: unknown, args: { despesaId: string; utilizadorId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.bloquear(args.despesaId, args.utilizadorId),

    atribuirCentroCusto: (
      _: unknown, args: { despesaId: string; centroCustoId: string }, ctx: GraphQLContext
    ) => ctx.repos.despesas.atribuirCentroCusto(args.despesaId, args.centroCustoId),

    atualizarValores: (
      _: unknown, args: { despesaId: string; input: Record<string, string> }, ctx: GraphQLContext
    ) => ctx.repos.despesas.atualizarValores(args.despesaId, args.input),

    confirmar: (_: unknown, args: { despesaId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.confirmar(args.despesaId),

    adiar: (_: unknown, args: { despesaId: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.adiar(args.despesaId),

    criarCentroCusto: (_: unknown, args: { input: CriarCentroCustoInput }, ctx: GraphQLContext) =>
      ctx.repos.centrosCusto.criar(args.input),

    atualizarCentroCusto: (
      _: unknown, args: { id: string; input: AtualizarCentroCustoInput }, ctx: GraphQLContext
    ) => ctx.repos.centrosCusto.atualizar(args.id, args.input),

    eliminarCentroCusto: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.repos.centrosCusto.eliminar(args.id);
      return true;
    },

    criarFornecedor: async (_: unknown, args: { input: CriarFornecedorInput }, ctx: GraphQLContext) => {
      validarNif(args.input.nif);
      return ctx.repos.fornecedores.criar(args.input);
    },

    atualizarFornecedor: async (
      _: unknown, args: { id: string; input: AtualizarFornecedorInput }, ctx: GraphQLContext
    ) => {
      if (args.input.nif) validarNif(args.input.nif);
      return ctx.repos.fornecedores.atualizar(args.id, args.input);
    },

    eliminarFornecedor: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.repos.fornecedores.eliminar(args.id);
      return true;
    },

    criarUtilizador: async (_: unknown, args: { input: CriarUtilizadorInput }, ctx: GraphQLContext) => {
      validarEmail(args.input.email);
      return ctx.repos.utilizadores.criar(args.input);
    },

    atualizarUtilizador: async (
      _: unknown, args: { id: string; input: AtualizarUtilizadorInput }, ctx: GraphQLContext
    ) => {
      if (args.input.email) validarEmail(args.input.email);
      return ctx.repos.utilizadores.atualizar(args.id, args.input);
    },

    eliminarUtilizador: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.repos.utilizadores.eliminar(args.id);
      return true;
    },

    criarTarefa: (_: unknown, args: { input: CriarTarefaInput }, ctx: GraphQLContext) =>
      ctx.repos.tarefas.criar(args.input),

    atualizarTarefa: (
      _: unknown, args: { id: string; input: AtualizarTarefaInput }, ctx: GraphQLContext
    ) => ctx.repos.tarefas.atualizar(args.id, args.input),

    eliminarTarefa: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.repos.tarefas.eliminar(args.id);
      return true;
    },

    eliminarTarefasFeitas: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.repos.tarefas.eliminarFeitas(),

    atualizarFuncionalidade: (
      _: unknown, args: { chave: string; ativa: boolean }, ctx: GraphQLContext
    ) => ctx.repos.funcionalidades.atualizar(args.chave, args.ativa),

    atualizarRotulosCentroCusto: async (
      _: unknown, args: { singular: string; plural: string }, ctx: GraphQLContext
    ) => {
      await ctx.repos.configuracao.definir(CHAVE_LABEL_SINGULAR, args.singular);
      await ctx.repos.configuracao.definir(CHAVE_LABEL_PLURAL, args.plural);
      return { singular: args.singular, plural: args.plural };
    },
  },

  Despesa: {
    fornecedor: (despesa: { nifFornecedor: string }, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.fornecedorPorNif.load(despesa.nifFornecedor),
    centroCusto: (despesa: { centroCustoId: string | null }, _: unknown, ctx: GraphQLContext) =>
      despesa.centroCustoId ? ctx.loaders.centroCustoPorId.load(despesa.centroCustoId) : null,
  },
};
