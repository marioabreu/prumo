import { describe, it, expect } from "vitest";
import { lockAtivoDeOutro } from "./types.js";
import { criarReposMemoria } from "./memoria.js";

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

  it("totaisPorCentroCusto só soma despesas CONFIRMADA com centroCustoId", async () => {
    const repos = criarReposMemoria([{ nome: "Obra Norte", ativa: true }]);
    const [centroCusto] = await repos.centrosCusto.listar();
    const d1 = await repos.despesas.criar(inputBase);
    await repos.despesas.atribuirCentroCusto(d1.id, centroCusto.id);
    await repos.despesas.confirmar(d1.id);
    const d2 = await repos.despesas.criar({ ...inputBase, numeroFatura: "FT 102" });
    await repos.despesas.atribuirCentroCusto(d2.id, centroCusto.id); // não confirmada — não deve contar

    const totais = await repos.despesas.totaisPorCentroCusto();
    expect(totais).toEqual([{ centroCustoId: centroCusto.id, total: "25.95" }]);
  });

  it("centrosCusto.criar rejeita nome duplicado", async () => {
    const repos = criarReposMemoria();
    await repos.centrosCusto.criar({ nome: "Obra Norte" });
    await expect(repos.centrosCusto.criar({ nome: "Obra Norte" })).rejects.toThrow();
  });

  it("centrosCusto.eliminar rejeita quando há despesas associadas, mas apaga quando não há", async () => {
    const repos = criarReposMemoria([{ nome: "Obra Norte", ativa: true }]);
    const [centroCusto] = await repos.centrosCusto.listar();
    const d = await repos.despesas.criar(inputBase);
    await repos.despesas.atribuirCentroCusto(d.id, centroCusto.id);

    await expect(repos.centrosCusto.eliminar(centroCusto.id)).rejects.toThrow(/despesas associadas/);

    const outro = await repos.centrosCusto.criar({ nome: "Obra Sem Uso" });
    await expect(repos.centrosCusto.eliminar(outro.id)).resolves.toBeUndefined();
    expect(await repos.centrosCusto.obterPorId(outro.id)).toBeNull();
  });

  it("fornecedores.criar rejeita NIF duplicado, e eliminar respeita despesas associadas", async () => {
    const repos = criarReposMemoria();
    const fornecedor = await repos.fornecedores.criar({ nif: "502544180", nome: "Leroy Merlin" });
    await expect(repos.fornecedores.criar({ nif: "502544180" })).rejects.toThrow();

    const d = await repos.despesas.criar({ ...inputBase, fornecedorId: fornecedor.id });
    await expect(repos.fornecedores.eliminar(fornecedor.id)).rejects.toThrow(/despesas associadas/);
    expect(d.fornecedorId).toBe(fornecedor.id);

    const outro = await repos.fornecedores.criar({ nif: "241489830" });
    await expect(repos.fornecedores.eliminar(outro.id)).resolves.toBeUndefined();
  });

  it("fornecedores.upsert preenche nome/morada em falta mas nunca sobrescreve um nome já definido", async () => {
    const repos = criarReposMemoria();

    const criado = await repos.fornecedores.upsert("502544180", { nome: "Empresa A", morada: "Lisboa" });
    expect(criado.nome).toBe("Empresa A");

    const semAlterar = await repos.fornecedores.upsert("502544180", { nome: "Nome Diferente", morada: "Porto" });
    expect(semAlterar.nome).toBe("Empresa A");
    expect(semAlterar.morada).toBe("Lisboa");

    const semNome = await repos.fornecedores.criar({ nif: "241489830" });
    const preenchido = await repos.fornecedores.upsert("241489830", { nome: "Preenchido Agora", morada: null });
    expect(preenchido.id).toBe(semNome.id);
    expect(preenchido.nome).toBe("Preenchido Agora");
  });

  it("configuracao.garantirExiste cria só se a chave não existir, nunca sobrescreve", async () => {
    const repos = criarReposMemoria();
    const criada = await repos.configuracao.garantirExiste("x", "valor-defeito");
    expect(criada.valor).toBe("valor-defeito");

    await repos.configuracao.definir("x", "valor-escolhido-pelo-utilizador");
    const reafirmada = await repos.configuracao.garantirExiste("x", "valor-defeito");
    expect(reafirmada.valor).toBe("valor-escolhido-pelo-utilizador");
    expect(await repos.configuracao.obter("x")).toBe("valor-escolhido-pelo-utilizador");
  });

  it("configuracao.obter devolve null para uma chave nunca definida", async () => {
    const repos = criarReposMemoria();
    expect(await repos.configuracao.obter("inexistente")).toBeNull();
  });

  it("utilizadores.criar rejeita email duplicado; eliminar não tem guard", async () => {
    const repos = criarReposMemoria();
    const u = await repos.utilizadores.criar({ nome: "Ana", email: "ana@exemplo.pt" });
    await expect(repos.utilizadores.criar({ nome: "Outra", email: "ana@exemplo.pt" })).rejects.toThrow();
    await expect(repos.utilizadores.eliminar(u.id)).resolves.toBeUndefined();
    expect(await repos.utilizadores.obterPorId(u.id)).toBeNull();
  });

  it("despesas.listar filtra por estado e por centroCustoId", async () => {
    const repos = criarReposMemoria([{ nome: "Obra Norte", ativa: true }]);
    const [centroCusto] = await repos.centrosCusto.listar();
    const d1 = await repos.despesas.criar(inputBase);
    await repos.despesas.atribuirCentroCusto(d1.id, centroCusto.id);
    await repos.despesas.confirmar(d1.id);
    await repos.despesas.criar({ ...inputBase, numeroFatura: "FT 102" });

    expect(await repos.despesas.listar()).toHaveLength(2);
    expect(await repos.despesas.listar({ estado: "CONFIRMADA" })).toEqual([expect.objectContaining({ id: d1.id })]);
    expect(await repos.despesas.listar({ centroCustoId: centroCusto.id })).toEqual([expect.objectContaining({ id: d1.id })]);
  });
});
