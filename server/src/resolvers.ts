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
      const { nifValido: _nifValido, ...dados } = qrParaDespesa(args.qrRaw);

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
