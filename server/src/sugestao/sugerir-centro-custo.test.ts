import { describe, it, expect } from "vitest";
import { sugerirCentroCusto } from "./sugerir-centro-custo.js";
import type { Despesa, CentroCusto } from "../repos/types.js";

function despesaHistorico(centroCustoId: string, diasAtras: number): Despesa {
  const criadaEm = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
  return {
    id: `d-${centroCustoId}-${diasAtras}`, nifFornecedor: "502544180", fornecedorId: null,
    numeroFatura: "x", dataFatura: "2026-01-01", baseTributavel: "1", valorIva: "1", valorTotal: "1",
    ficheiroUrl: "x", qrRaw: null, origem: "UPLOAD", centroCustoId, estado: "CONFIRMADA",
    lockPorId: null, lockExpiraEm: null, criadaEm,
  };
}

describe("sugerirCentroCusto", () => {
  const centroA: CentroCusto = { id: "centro-a", nome: "Obra A", ativa: true };
  const centroB: CentroCusto = { id: "centro-b", nome: "Obra B", ativa: true };

  it("sugere o centro de custo dominante quando 3 das ultimas 4 faturas do fornecedor foram para lá", () => {
    const historico = [
      despesaHistorico(centroA.id, 1), despesaHistorico(centroA.id, 5),
      despesaHistorico(centroA.id, 10), despesaHistorico(centroB.id, 20),
    ];
    const sugestao = sugerirCentroCusto(historico, [centroA, centroB]);
    expect(sugestao?.centroCustoId).toBe(centroA.id);
    expect(sugestao?.motivo).toContain("3 das últimas 4 faturas deste fornecedor");
  });

  it("devolve null (não adivinha) abaixo do threshold de 0.6", () => {
    const historico = [despesaHistorico(centroA.id, 1), despesaHistorico(centroB.id, 2)];
    const sugestao = sugerirCentroCusto(historico, [centroA, centroB]);
    expect(sugestao).toBeNull();
  });

  it("devolve null sem historico nenhum", () => {
    expect(sugerirCentroCusto([], [centroA, centroB])).toBeNull();
  });

  it("dá boost a um centro de custo ativo quando o score fica próximo do threshold", () => {
    const centroInativo: CentroCusto = { id: "centro-c", nome: "Obra C", ativa: false };
    const historico = [
      despesaHistorico(centroInativo.id, 1), despesaHistorico(centroInativo.id, 40),
      despesaHistorico(centroA.id, 2),
    ];
    const sugestao = sugerirCentroCusto(historico, [centroA]); // só centroA está ativo/candidato
    expect(sugestao?.centroCustoId).toBe(centroA.id);
  });
});
