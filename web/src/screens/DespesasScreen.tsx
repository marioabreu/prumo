import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { DESPESAS, DESPESA, ATUALIZAR_VALORES, ATRIBUIR_CENTRO_CUSTO, CENTROS_CUSTO, type EstadoDespesa } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { ListRow } from "../ui/ListRow.js";
import { StatusDot, type StatusDotTone } from "../ui/StatusDot.js";
import { Label } from "../ui/Label.js";
import { StatRow } from "../ui/StatRow.js";
import { TextField } from "../ui/TextField.js";
import { Button } from "../ui/Button.js";
import { ShortcutButton } from "../ui/ShortcutButton.js";
import { useRotulosCentroCusto } from "../ui/useRotulosCentroCusto.js";
import styles from "./DespesasScreen.module.css";

const TOM_POR_ESTADO: Record<EstadoDespesa, StatusDotTone> = {
  POR_REVER: "pending",
  CONFIRMADA: "confirmed",
  ADIADA: "deferred",
};

export function DespesasScreen() {
  const rotulos = useRotulosCentroCusto();
  const [filtroEstado, setFiltroEstado] = useState<EstadoDespesa | "">("");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const { data: listaData } = useQuery(DESPESAS, {
    variables: { estado: filtroEstado || undefined, centroCustoId: undefined },
  });
  const { data: detalheData } = useQuery(DESPESA, {
    variables: { id: selecionadaId! },
    skip: !selecionadaId,
  });
  const { data: centrosCustoData } = useQuery(CENTROS_CUSTO);

  const [atualizarValores] = useMutation(ATUALIZAR_VALORES);
  const [atribuirCentroCusto] = useMutation(ATRIBUIR_CENTRO_CUSTO);

  const despesas = listaData?.despesas ?? [];
  const despesa = detalheData?.despesa ?? null;

  const [baseTributavel, setBaseTributavel] = useState("");
  const [valorIva, setValorIva] = useState("");
  const [valorTotal, setValorTotal] = useState("");

  useEffect(() => {
    if (!despesa) return;
    setBaseTributavel(despesa.baseTributavel);
    setValorIva(despesa.valorIva);
    setValorTotal(despesa.valorTotal);
  }, [despesa]);

  async function guardarValores() {
    if (!despesa) return;
    // Não é preciso refetch: a resposta da mutation atualiza a entidade Despesa
    // normalizada na InMemoryCache, e esta query lê a mesma entidade.
    await atualizarValores({
      variables: { despesaId: despesa.id, input: { baseTributavel, valorIva, valorTotal } },
    });
    setMensagem("Valores guardados.");
  }

  async function reatribuirCentroCusto(centroCustoId: string) {
    if (!despesa) return;
    await atribuirCentroCusto({ variables: { despesaId: despesa.id, centroCustoId } });
    setMensagem(`${rotulos.singular} atualizada.`);
  }

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.title}>Despesas</div>
        <select
          className={styles.filter}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoDespesa | "")}
        >
          <option value="">Todos os estados</option>
          <option value="POR_REVER">Por rever</option>
          <option value="CONFIRMADA">Confirmada</option>
          <option value="ADIADA">Adiada</option>
        </select>

        <Card padding="sm" className={styles.list}>
          {despesas.length === 0 && <div className={styles.empty}>Nenhuma despesa encontrada.</div>}
          {despesas.map((d) => (
            <ListRow
              key={d.id}
              primary={d.fornecedor?.nome ?? d.nifFornecedor}
              secondary={`${d.numeroFatura} · ${d.valorTotal}€`}
              tone={TOM_POR_ESTADO[d.estado]}
              active={d.id === selecionadaId}
              onClick={() => { setSelecionadaId(d.id); setMensagem(null); }}
            />
          ))}
        </Card>
      </div>

      {despesa && (
        <Card>
          <div className={styles.detail}>
            <div>
              <StatusDot tone={TOM_POR_ESTADO[despesa.estado]} /> {despesa.estado}
            </div>
            <StatRow label="Fornecedor" value={despesa.fornecedor?.nome ?? despesa.nifFornecedor} />
            <StatRow label="NIF" value={despesa.nifFornecedor} />
            <StatRow label="Número" value={despesa.numeroFatura} />
            <StatRow label="Data" value={despesa.dataFatura} />
            <StatRow label="Origem" value={despesa.origem} />
            <div>
              <Label>Ficheiro</Label>{" "}
              <a className={styles.link} href={despesa.ficheiroUrl} target="_blank" rel="noreferrer">
                {despesa.ficheiroUrl}
              </a>
            </div>

            <div className={styles.fields}>
              <TextField label="Base tributável" value={baseTributavel} onChange={(e) => setBaseTributavel(e.target.value)} />
              <TextField label="IVA" value={valorIva} onChange={(e) => setValorIva(e.target.value)} />
              <TextField label="Total" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
            </div>
            <Button variant="primary" onClick={guardarValores}>Guardar valores</Button>

            <div>
              <Label>{rotulos.singular}</Label>
              <div className={styles.obraGrid}>
                {(centrosCustoData?.centrosCusto ?? []).map((c, i) => (
                  <ShortcutButton
                    key={c.id}
                    index={i + 1}
                    label={c.nome}
                    selected={despesa.centroCusto?.id === c.id}
                    onClick={() => reatribuirCentroCusto(c.id)}
                  />
                ))}
              </div>
            </div>

            {mensagem && <div className={styles.feedback}>{mensagem}</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
