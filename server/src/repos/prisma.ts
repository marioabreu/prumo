import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  Repos, CriarDespesaInput, AtualizarValoresInput, TotalObra, DespesasFiltro,
  CriarObraInput, AtualizarObraInput,
  CriarFornecedorInput, AtualizarFornecedorInput,
  CriarUtilizadorInput, AtualizarUtilizadorInput,
} from "./types.js";
import { lockAtivoDeOutro, LOCK_TTL_MS, ERRO_OBRA_EM_USO, ERRO_FORNECEDOR_EM_USO } from "./types.js";

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

function ehViolacaoDeFK(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003";
}

export function criarReposPrisma(prisma: PrismaClient): Repos {
  return {
    obras: {
      async listar() { return prisma.obra.findMany(); },
      async ativas() { return prisma.obra.findMany({ where: { ativa: true } }); },
      async obterPorId(id) { return prisma.obra.findUnique({ where: { id } }); },
      async criar(input: CriarObraInput) {
        return prisma.obra.create({ data: { nome: input.nome, ativa: input.ativa ?? true } });
      },
      async atualizar(id, patch: AtualizarObraInput) {
        return prisma.obra.update({ where: { id }, data: patch });
      },
      async eliminar(id) {
        try {
          await prisma.obra.delete({ where: { id } });
        } catch (e) {
          if (ehViolacaoDeFK(e)) throw new Error(ERRO_OBRA_EM_USO);
          throw e;
        }
      },
    },
    fornecedores: {
      async listar() { return prisma.fornecedor.findMany(); },
      async obterPorNif(nif) { return prisma.fornecedor.findUnique({ where: { nif } }); },
      async upsert(nif, nome = null) {
        return prisma.fornecedor.upsert({
          where: { nif },
          update: nome ? { nome } : {},
          create: { nif, nome },
        });
      },
      async criar(input: CriarFornecedorInput) {
        return prisma.fornecedor.create({
          data: { nif: input.nif, nome: input.nome ?? null, morada: input.morada ?? null },
        });
      },
      async atualizar(id, patch: AtualizarFornecedorInput) {
        return prisma.fornecedor.update({ where: { id }, data: patch });
      },
      async eliminar(id) {
        try {
          await prisma.fornecedor.delete({ where: { id } });
        } catch (e) {
          if (ehViolacaoDeFK(e)) throw new Error(ERRO_FORNECEDOR_EM_USO);
          throw e;
        }
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
    utilizadores: {
      async listar() { return prisma.utilizador.findMany(); },
      async obterPorId(id) { return prisma.utilizador.findUnique({ where: { id } }); },
      async criar(input: CriarUtilizadorInput) {
        return prisma.utilizador.create({ data: { nome: input.nome, email: input.email } });
      },
      async atualizar(id, patch: AtualizarUtilizadorInput) {
        return prisma.utilizador.update({ where: { id }, data: patch });
      },
      async eliminar(id) {
        await prisma.utilizador.delete({ where: { id } });
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
      async listar(filtro?: DespesasFiltro) {
        const rows = await prisma.despesa.findMany({
          where: { estado: filtro?.estado, obraId: filtro?.obraId },
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
