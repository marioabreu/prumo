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
