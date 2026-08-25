import type { Despesa, CentroCusto } from "../repos/types.js";

export interface SugestaoCentroCusto {
  centroCustoId: string;
  motivo: string;
  score: number;
}

const MEIA_VIDA_DIAS = 60; // peso do histórico cai para metade a cada 60 dias

function pesoPorRecencia(criadaEm: Date, agora: Date): number {
  const diasAtras = (agora.getTime() - criadaEm.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, diasAtras / MEIA_VIDA_DIAS);
}

/**
 * Heurística explicável: pondera o histórico do fornecedor por recência e
 * só compete entre centros de custo ativos (faturas antigas de um centro de
 * custo já fechado não contam a favor de o sugerir de novo — o boost "ativo"
 * da decisão #5 do CLAUDE.md é, na prática, restringir os candidatos aos
 * ativos). Só sugere acima do threshold — abaixo disso devolve null porque o
 * custo de sugerir mal (contaminar o total em silêncio) é maior que o de não
 * sugerir (custa uma tecla).
 */
export function sugerirCentroCusto(
  historico: Despesa[],
  centrosCustoAtivos: CentroCusto[],
  scoreMin = 0.6,
  agora: Date = new Date()
): SugestaoCentroCusto | null {
  if (historico.length === 0) return null;

  const ativosIds = new Set(centrosCustoAtivos.map((c) => c.id));
  const pesos = new Map<string, number>();
  let pesoTotal = 0;

  for (const d of historico) {
    if (!d.centroCustoId || !ativosIds.has(d.centroCustoId)) continue;
    const peso = pesoPorRecencia(d.criadaEm, agora);
    pesos.set(d.centroCustoId, (pesos.get(d.centroCustoId) ?? 0) + peso);
    pesoTotal += peso;
  }
  if (pesoTotal === 0) return null;

  let melhorCentroCustoId: string | null = null;
  let melhorScore = 0;
  for (const [centroCustoId, peso] of pesos) {
    const score = peso / pesoTotal;
    if (score > melhorScore) { melhorScore = score; melhorCentroCustoId = centroCustoId; }
  }
  if (!melhorCentroCustoId || melhorScore < scoreMin) return null;

  const ultimas = [...historico]
    .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime())
    .slice(0, 4);
  const nUltimas = ultimas.filter((d) => d.centroCustoId === melhorCentroCustoId).length;

  return {
    centroCustoId: melhorCentroCustoId,
    score: Math.min(melhorScore, 1),
    motivo: `${nUltimas} das últimas ${ultimas.length} faturas deste fornecedor foram para este centro de custo`,
  };
}
