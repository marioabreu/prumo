import type { Despesa, Obra } from "../repos/types.js";

export interface SugestaoObra {
  obraId: string;
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
 * só compete entre obras ativas (faturas antigas de uma obra já fechada não
 * contam a favor de a sugerir de novo — o boost "obra ativa" da decisão #5
 * do CLAUDE.md é, na prática, restringir os candidatos às obras ativas).
 * Só sugere acima do threshold — abaixo disso devolve null porque o custo
 * de sugerir mal (contaminar o total da obra em silêncio) é maior que o de
 * não sugerir (custa uma tecla).
 */
export function sugerirObra(
  historico: Despesa[],
  obrasAtivas: Obra[],
  scoreMin = 0.6,
  agora: Date = new Date()
): SugestaoObra | null {
  if (historico.length === 0) return null;

  const ativasIds = new Set(obrasAtivas.map((o) => o.id));
  const pesos = new Map<string, number>();
  let pesoTotal = 0;

  for (const d of historico) {
    if (!d.obraId || !ativasIds.has(d.obraId)) continue;
    const peso = pesoPorRecencia(d.criadaEm, agora);
    pesos.set(d.obraId, (pesos.get(d.obraId) ?? 0) + peso);
    pesoTotal += peso;
  }
  if (pesoTotal === 0) return null;

  let melhorObraId: string | null = null;
  let melhorScore = 0;
  for (const [obraId, peso] of pesos) {
    const score = peso / pesoTotal;
    if (score > melhorScore) { melhorScore = score; melhorObraId = obraId; }
  }
  if (!melhorObraId || melhorScore < scoreMin) return null;

  const ultimas = [...historico]
    .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime())
    .slice(0, 4);
  const nUltimas = ultimas.filter((d) => d.obraId === melhorObraId).length;

  return {
    obraId: melhorObraId,
    score: Math.min(melhorScore, 1),
    motivo: `${nUltimas} das últimas ${ultimas.length} faturas deste fornecedor foram para esta obra`,
  };
}
