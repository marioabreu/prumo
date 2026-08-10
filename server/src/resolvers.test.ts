import { describe, it, expect, vi } from "vitest";
import { resolvers } from "./resolvers.js";
import { criarReposMemoria } from "./repos/memoria.js";
import { criarLoaders } from "./loaders/index.js";
import type { PesquisarEmpresa } from "./pesquisa-empresa/pesquisar-empresa.js";

function ctxDeTeste(
  seedObras: { nome: string; ativa: boolean }[] = [],
  pesquisarEmpresa: PesquisarEmpresa = async () => ({ nome: null, morada: null })
) {
  const repos = criarReposMemoria(seedObras);
  return {
    repos,
    loaders: criarLoaders(repos),
    extrair: async () => { throw new Error("não usado neste teste"); },
    pesquisarEmpresa,
  };
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

  it("liga o fornecedorId da despesa criada ao fornecedor upsertado (regressão)", async () => {
    const ctx = ctxDeTeste();
    const { despesa } = await resolvers.Mutation.ingerirFatura(
      {}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx
    );
    const fornecedor = await ctx.repos.fornecedores.obterPorNif("502544180");
    expect(despesa.fornecedorId).toBe(fornecedor?.id);
  });

  it("devolve duplicada:true na segunda ingestão da mesma chave, sem criar outra despesa", async () => {
    const ctx = ctxDeTeste();
    await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx);
    const segunda = await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f2.pdf", qrRaw }, ctx);
    expect(segunda.duplicada).toBe(true);
    const fila = await ctx.repos.despesas.listar();
    expect(fila).toHaveLength(1);
  });

  it("pesquisa o nome/morada da empresa quando o fornecedor é novo e guarda-os", async () => {
    const pesquisarEmpresa = vi.fn().mockResolvedValue({ nome: "Vodafone Portugal", morada: "Lisboa" });
    const ctx = ctxDeTeste([], pesquisarEmpresa);

    await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx);

    expect(pesquisarEmpresa).toHaveBeenCalledWith("502544180");
    const fornecedor = await ctx.repos.fornecedores.obterPorNif("502544180");
    expect(fornecedor?.nome).toBe("Vodafone Portugal");
    expect(fornecedor?.morada).toBe("Lisboa");
  });

  it("não pesquisa de novo quando o fornecedor já tem nome (evita chamadas repetidas)", async () => {
    const pesquisarEmpresa = vi.fn().mockResolvedValue({ nome: "Nome Novo Da Pesquisa", morada: null });
    const ctx = ctxDeTeste([], pesquisarEmpresa);
    await ctx.repos.fornecedores.criar({ nif: "502544180", nome: "Nome Definido Manualmente" });

    await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx);

    expect(pesquisarEmpresa).not.toHaveBeenCalled();
    const fornecedor = await ctx.repos.fornecedores.obterPorNif("502544180");
    expect(fornecedor?.nome).toBe("Nome Definido Manualmente");
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

describe("Query.despesas e Query.despesa", () => {
  const inputBase = {
    ficheiroUrl: "https://x/f.pdf",
    qrRaw: "A:502544180*D:FT*F:20260725*G:FT1*O:25.95",
  };

  it("Query.despesas filtra por estado e obraId", async () => {
    const ctx = ctxDeTeste([{ nome: "Obra Norte", ativa: true }]);
    const [obra] = await ctx.repos.obras.listar();
    const { despesa } = await resolvers.Mutation.ingerirFatura({}, inputBase, ctx);
    await resolvers.Mutation.atribuirObra({}, { despesaId: despesa.id, obraId: obra.id }, ctx);
    await resolvers.Mutation.confirmar({}, { despesaId: despesa.id }, ctx);

    expect(await resolvers.Query.despesas({}, {}, ctx)).toHaveLength(1);
    expect(await resolvers.Query.despesas({}, { estado: "CONFIRMADA" }, ctx)).toHaveLength(1);
    expect(await resolvers.Query.despesas({}, { estado: "POR_REVER" }, ctx)).toHaveLength(0);
    expect(await resolvers.Query.despesas({}, { obraId: obra.id }, ctx)).toHaveLength(1);
  });

  it("Query.despesa devolve a despesa por id, ou null se não existir", async () => {
    const ctx = ctxDeTeste();
    const { despesa } = await resolvers.Mutation.ingerirFatura({}, inputBase, ctx);
    expect(await resolvers.Query.despesa({}, { id: despesa.id }, ctx)).toMatchObject({ id: despesa.id });
    expect(await resolvers.Query.despesa({}, { id: "inexistente" }, ctx)).toBeNull();
  });
});

describe("CRUD de Obra", () => {
  it("criarObra/atualizarObra funcionam e rejeitam nome duplicado", async () => {
    const ctx = ctxDeTeste();
    const obra = await resolvers.Mutation.criarObra({}, { input: { nome: "Obra A" } }, ctx);
    expect(obra.ativa).toBe(true);

    const atualizada = await resolvers.Mutation.atualizarObra({}, { id: obra.id, input: { ativa: false } }, ctx);
    expect(atualizada.ativa).toBe(false);

    await expect(
      resolvers.Mutation.criarObra({}, { input: { nome: "Obra A" } }, ctx)
    ).rejects.toThrow();
  });

  it("eliminarObra rejeita quando há despesas associadas, e devolve true quando elimina", async () => {
    const ctx = ctxDeTeste([{ nome: "Obra Norte", ativa: true }]);
    const [obra] = await ctx.repos.obras.listar();
    const { despesa } = await resolvers.Mutation.ingerirFatura(
      {}, { ficheiroUrl: "https://x/f.pdf", qrRaw: "A:502544180*D:FT*F:20260725*G:FT1*O:25.95" }, ctx
    );
    await resolvers.Mutation.atribuirObra({}, { despesaId: despesa.id, obraId: obra.id }, ctx);

    await expect(resolvers.Mutation.eliminarObra({}, { id: obra.id }, ctx)).rejects.toThrow();

    const outra = await resolvers.Mutation.criarObra({}, { input: { nome: "Obra Sem Uso" } }, ctx);
    await expect(resolvers.Mutation.eliminarObra({}, { id: outra.id }, ctx)).resolves.toBe(true);
  });
});

describe("CRUD de Fornecedor", () => {
  it("criarFornecedor rejeita NIF inválido antes de tocar no repo", async () => {
    const ctx = ctxDeTeste();
    await expect(
      resolvers.Mutation.criarFornecedor({}, { input: { nif: "502544181" } }, ctx)
    ).rejects.toThrow(/NIF inválido/);
  });

  it("criarFornecedor/atualizarFornecedor funcionam com NIF válido", async () => {
    const ctx = ctxDeTeste();
    const fornecedor = await resolvers.Mutation.criarFornecedor(
      {}, { input: { nif: "502544180", nome: "Leroy Merlin" } }, ctx
    );
    const atualizado = await resolvers.Mutation.atualizarFornecedor(
      {}, { id: fornecedor.id, input: { morada: "Rua X, 1" } }, ctx
    );
    expect(atualizado.morada).toBe("Rua X, 1");
  });

  it("eliminarFornecedor rejeita quando há despesas associadas", async () => {
    const ctx = ctxDeTeste();
    const fornecedor = await resolvers.Mutation.criarFornecedor({}, { input: { nif: "502544180" } }, ctx);
    await ctx.repos.despesas.criar({
      nifFornecedor: "502544180", fornecedorId: fornecedor.id, numeroFatura: "FT1", dataFatura: "2026-01-01",
      baseTributavel: "1", valorIva: "1", valorTotal: "1", ficheiroUrl: "x", qrRaw: null, origem: "UPLOAD",
    });
    await expect(resolvers.Mutation.eliminarFornecedor({}, { id: fornecedor.id }, ctx)).rejects.toThrow();
  });
});

describe("CRUD de Utilizador", () => {
  it("criarUtilizador rejeita email inválido, aceita email válido, elimina sem guard", async () => {
    const ctx = ctxDeTeste();
    await expect(
      resolvers.Mutation.criarUtilizador({}, { input: { nome: "Ana", email: "não-é-email" } }, ctx)
    ).rejects.toThrow(/Email inválido/);

    const u = await resolvers.Mutation.criarUtilizador({}, { input: { nome: "Ana", email: "ana@exemplo.pt" } }, ctx);
    expect(await resolvers.Mutation.eliminarUtilizador({}, { id: u.id }, ctx)).toBe(true);
  });
});

describe("CRUD de Tarefa", () => {
  it("criarTarefa começa por feita:false, atualizarTarefa marca como feita", async () => {
    const ctx = ctxDeTeste();
    const tarefa = await resolvers.Mutation.criarTarefa({}, { input: { texto: "Adicionar export CSV" } }, ctx);
    expect(tarefa.feita).toBe(false);

    const feita = await resolvers.Mutation.atualizarTarefa({}, { id: tarefa.id, input: { feita: true } }, ctx);
    expect(feita.feita).toBe(true);
    expect(feita.texto).toBe("Adicionar export CSV");
  });

  it("eliminarTarefa remove uma tarefa; eliminarTarefasFeitas remove só as concluídas", async () => {
    const ctx = ctxDeTeste();
    const a = await resolvers.Mutation.criarTarefa({}, { input: { texto: "A" } }, ctx);
    const b = await resolvers.Mutation.criarTarefa({}, { input: { texto: "B" } }, ctx);
    const c = await resolvers.Mutation.criarTarefa({}, { input: { texto: "C" } }, ctx);
    await resolvers.Mutation.atualizarTarefa({}, { id: b.id, input: { feita: true } }, ctx);
    await resolvers.Mutation.atualizarTarefa({}, { id: c.id, input: { feita: true } }, ctx);

    expect(await resolvers.Mutation.eliminarTarefa({}, { id: a.id }, ctx)).toBe(true);

    const removidas = await resolvers.Mutation.eliminarTarefasFeitas({}, {}, ctx);
    expect(removidas).toBe(2);

    const restantes = await resolvers.Query.tarefas({}, {}, ctx);
    expect(restantes).toHaveLength(0);
  });
});
