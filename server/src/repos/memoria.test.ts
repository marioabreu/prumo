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
