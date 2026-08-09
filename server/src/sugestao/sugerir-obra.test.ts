import { describe, it, expect } from "vitest";
import { sugerirObra } from "./sugerir-obra.js";
import type { Despesa, Obra } from "../repos/types.js";

function despesaHistorico(obraId: string, diasAtras: number): Despesa {
  const criadaEm = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
  return {
    id: `d-${obraId}-${diasAtras}`, nifFornecedor: "502544180", fornecedorId: null,
    numeroFatura: "x", dataFatura: "2026-01-01", baseTributavel: "1", valorIva: "1", valorTotal: "1",
    ficheiroUrl: "x", qrRaw: null, origem: "UPLOAD", obraId, estado: "CONFIRMADA",
    lockPorId: null, lockExpiraEm: null, criadaEm,
  };
}

describe("sugerirObra", () => {
  const obraA: Obra = { id: "obra-a", nome: "Obra A", ativa: true };
  const obraB: Obra = { id: "obra-b", nome: "Obra B", ativa: true };

  it("sugere a obra dominante quando 3 das ultimas 4 faturas do fornecedor foram para lá", () => {
    const historico = [
      despesaHistorico(obraA.id, 1), despesaHistorico(obraA.id, 5),
      despesaHistorico(obraA.id, 10), despesaHistorico(obraB.id, 20),
    ];
    const sugestao = sugerirObra(historico, [obraA, obraB]);
    expect(sugestao?.obraId).toBe(obraA.id);
    expect(sugestao?.motivo).toContain("3 das últimas 4 faturas deste fornecedor");
  });

  it("devolve null (não adivinha) abaixo do threshold de 0.6", () => {
    const historico = [despesaHistorico(obraA.id, 1), despesaHistorico(obraB.id, 2)];
    const sugestao = sugerirObra(historico, [obraA, obraB]);
    expect(sugestao).toBeNull();
  });

  it("devolve null sem historico nenhum", () => {
    expect(sugerirObra([], [obraA, obraB])).toBeNull();
  });

  it("dá boost a uma obra ativa quando o score fica próximo do threshold", () => {
    const obraInativa: Obra = { id: "obra-c", nome: "Obra C", ativa: false };
    const historico = [
      despesaHistorico(obraInativa.id, 1), despesaHistorico(obraInativa.id, 40),
      despesaHistorico(obraA.id, 2),
    ];
    const sugestao = sugerirObra(historico, [obraA]); // só obraA está ativa/candidata
    expect(sugestao?.obraId).toBe(obraA.id);
  });
});
