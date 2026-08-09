import type { GraphQLContext } from "./context.js";
import { qrParaDespesa, nifValido } from "@prumo/shared";
import { sugerirObra } from "./sugestao/sugerir-obra.js";
import type {
  EstadoDespesa, CriarObraInput, AtualizarObraInput,
  CriarFornecedorInput, AtualizarFornecedorInput,
  CriarUtilizadorInput, AtualizarUtilizadorInput,
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
      _: unknown, args: { estado?: EstadoDespesa; obraId?: string }, ctx: GraphQLContext
    ) => ctx.repos.despesas.listar({ estado: args.estado, obraId: args.obraId }),

    despesa: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.repos.despesas.obterPorId(args.id),

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
    fornecedores: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.fornecedores.listar(),
    utilizadores: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.repos.utilizadores.listar(),
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

      const fornecedor = await ctx.repos.fornecedores.upsert(dados.nifFornecedor);
      const despesa = await ctx.repos.despesas.criar({
        ...dados, fornecedorId: fornecedor.id, ficheiroUrl: args.ficheiroUrl, qrRaw: args.qrRaw, origem: "UPLOAD",
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

    criarObra: (_: unknown, args: { input: CriarObraInput }, ctx: GraphQLContext) =>
      ctx.repos.obras.criar(args.input),

    atualizarObra: (_: unknown, args: { id: string; input: AtualizarObraInput }, ctx: GraphQLContext) =>
      ctx.repos.obras.atualizar(args.id, args.input),

    eliminarObra: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.repos.obras.eliminar(args.id);
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
  },

  Despesa: {
    fornecedor: (despesa: { nifFornecedor: string }, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.fornecedorPorNif.load(despesa.nifFornecedor),
    obra: (despesa: { obraId: string | null }, _: unknown, ctx: GraphQLContext) =>
      despesa.obraId ? ctx.loaders.obraPorId.load(despesa.obraId) : null,
  },
};
