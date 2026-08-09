import { useQuery, useMutation } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { FILA_REVISAO, SUGESTAO_OBRA, OBRAS, ATRIBUIR_OBRA, CONFIRMAR, ADIAR } from "./graphql.js";

export function FilaRevisao() {
  const { data, refetch } = useQuery(FILA_REVISAO);
  const { data: obrasData } = useQuery(OBRAS);
  const [atribuirObra] = useMutation(ATRIBUIR_OBRA);
  const [confirmar] = useMutation(CONFIRMAR);
  const [adiar] = useMutation(ADIAR);

  const fila = data?.filaRevisao ?? [];
  const atual = fila[0];

  const { data: sugestaoData } = useQuery(SUGESTAO_OBRA, {
    variables: { despesaId: atual?.id },
    skip: !atual,
  });
  const sugestao = sugestaoData?.sugestaoObra ?? null;

  const [obraEscolhidaId, setObraEscolhidaId] = useState<string | null>(null);
  useEffect(() => { setObraEscolhidaId(sugestao?.obraId ?? null); }, [sugestao, atual?.id]);

  async function confirmarAtual() {
    if (!atual || !obraEscolhidaId) return;
    await atribuirObra({ variables: { despesaId: atual.id, obraId: obraEscolhidaId } });
    await confirmar({ variables: { despesaId: atual.id } });
    await refetch();
  }

  async function adiarAtual() {
    if (!atual) return;
    await adiar({ variables: { despesaId: atual.id } });
    await refetch();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") confirmarAtual();
      if (e.key === "Escape") adiarAtual();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!atual) return <p>Fila de revisão vazia.</p>;

  return (
    <div>
      <p>{atual.fornecedor?.nome ?? atual.nifFornecedor}</p>
      <p>{atual.numeroFatura} — {atual.dataFatura} — {atual.valorTotal}€</p>

      <label>
        Obra
        <select value={obraEscolhidaId ?? ""} onChange={(e) => setObraEscolhidaId(e.target.value || null)}>
          <option value="">— escolher —</option>
          {(obrasData?.obras ?? []).map((o: { id: string; nome: string }) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
      </label>

      {sugestao && <p>Sugestão: {sugestao.motivo} (score {sugestao.score.toFixed(2)})</p>}

      <button onClick={confirmarAtual} disabled={!obraEscolhidaId}>Confirmar (Enter)</button>
      <button onClick={adiarAtual}>Adiar (Esc)</button>
    </div>
  );
}
