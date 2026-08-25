import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  FILA_REVISAO, SUGESTAO_CENTRO_CUSTO, CENTROS_CUSTO, TOTAIS_POR_CENTRO_CUSTO,
  ATRIBUIR_CENTRO_CUSTO, CONFIRMAR, ADIAR, ATUALIZAR_VALORES,
} from "./graphql.js";
import { Card } from "./ui/Card.js";
import { ListRow } from "./ui/ListRow.js";
import { Badge } from "./ui/Badge.js";
import { Label } from "./ui/Label.js";
import { StatRow } from "./ui/StatRow.js";
import { Button } from "./ui/Button.js";
import { TextField } from "./ui/TextField.js";
import { SearchInput } from "./ui/SearchInput.js";
import { ShortcutButton } from "./ui/ShortcutButton.js";
import { ProgressBar } from "./ui/ProgressBar.js";
import { useShortcutBar } from "./ui/AppShell.js";
import { useRotulosCentroCusto } from "./ui/useRotulosCentroCusto.js";
import styles from "./FilaRevisao.module.css";

export function FilaRevisao() {
  const rotulos = useRotulosCentroCusto();
  const { data, refetch } = useQuery(FILA_REVISAO, { fetchPolicy: "cache-and-network" });
  const { data: centrosCustoData } = useQuery(CENTROS_CUSTO);
  const { data: totaisData } = useQuery(TOTAIS_POR_CENTRO_CUSTO);
  const [atribuirCentroCusto] = useMutation(ATRIBUIR_CENTRO_CUSTO);
  const [confirmar] = useMutation(CONFIRMAR);
  const [adiar] = useMutation(ADIAR);
  const [atualizarValores] = useMutation(ATUALIZAR_VALORES);

  const fila = data?.filaRevisao ?? [];
  const atual = fila[0];
  const centrosCusto = centrosCustoData?.centrosCusto ?? [];
  const totais = totaisData?.totaisPorCentroCusto ?? [];

  const { data: sugestaoData } = useQuery(SUGESTAO_CENTRO_CUSTO, {
    variables: { despesaId: atual?.id ?? "" },
    skip: !atual,
  });
  const sugestao = sugestaoData?.sugestaoCentroCusto ?? null;

  const [centroCustoEscolhidoId, setCentroCustoEscolhidoId] = useState<string | null>(null);
  const [procuraCentroCusto, setProcuraCentroCusto] = useState("");
  const [editando, setEditando] = useState(false);
  const [baseTributavel, setBaseTributavel] = useState("");
  const [valorIva, setValorIva] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [confirmadas, setConfirmadas] = useState(0);

  useEffect(() => {
    setCentroCustoEscolhidoId(sugestao?.centroCustoId ?? null);
    // dependência em sugestao?.centroCustoId (primitivo), não no objeto sugestao — o
    // objeto muda de referência a cada leitura da cache mesmo com o mesmo conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestao?.centroCustoId, atual?.id]);

  useEffect(() => {
    setEditando(false);
    setProcuraCentroCusto("");
  }, [atual?.id]);

  useEffect(() => {
    if (!atual) return;
    setBaseTributavel(atual.baseTributavel);
    setValorIva(atual.valorIva);
    setValorTotal(atual.valorTotal);
  }, [atual]);

  const centrosCustoFiltrados = centrosCusto.filter(
    (c) => c.nome.toLowerCase().includes(procuraCentroCusto.toLowerCase())
  );

  async function confirmarAtual() {
    if (!atual || !centroCustoEscolhidoId) return;
    await atribuirCentroCusto({ variables: { despesaId: atual.id, centroCustoId: centroCustoEscolhidoId } });
    await confirmar({ variables: { despesaId: atual.id } });
    setConfirmadas((c) => c + 1);
    await refetch();
  }

  async function adiarAtual() {
    if (!atual) return;
    await adiar({ variables: { despesaId: atual.id } });
    await refetch();
  }

  async function guardarValores() {
    if (!atual) return;
    await atualizarValores({ variables: { despesaId: atual.id, input: { baseTributavel, valorIva, valorTotal } } });
    setEditando(false);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (editando) {
        if (e.key === "Escape") setEditando(false);
        return;
      }
      if (e.key === "Enter") confirmarAtual();
      else if (e.key.toLowerCase() === "s") adiarAtual();
      else if (e.key.toLowerCase() === "e") setEditando(true);
      else if (/^[1-9]$/.test(e.key)) {
        const centroCusto = centrosCustoFiltrados[Number(e.key) - 1];
        if (centroCusto) setCentroCustoEscolhidoId(centroCusto.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useShortcutBar(
    editando
      ? [{ keys: "Esc", action: "cancelar edição" }]
      : [
          { keys: "↵", action: "confirmar" },
          { keys: "1–9", action: `atribuir ${rotulos.singular.toLowerCase()}` },
          { keys: "E", action: "editar" },
          { keys: "S", action: "adiar" },
        ]
  );

  const totalSessao = fila.length + confirmadas;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.title}>Faturas por rever</div>
          <div className={styles.counts}>{fila.length} na fila · {confirmadas} confirmadas</div>
        </div>
        <div className={styles.progressWrap}>
          <ProgressBar value={confirmadas} max={totalSessao || 1} />
        </div>
      </div>

      <div className={styles.layout}>
        <Card padding="sm" className={styles.list}>
          {fila.length === 0 && <div className={styles.empty}>Fila de revisão vazia.</div>}
          {fila.map((d, i) => (
            <ListRow
              key={d.id}
              primary={d.fornecedor?.nome ?? d.nifFornecedor}
              secondary={`${d.valorTotal}€`}
              active={i === 0}
            />
          ))}
        </Card>

        {atual ? (
          <div className={styles.detail}>
            <div>
              {atual.qrRaw
                ? <Badge tone="success">✓ QR · fiscal garantido</Badge>
                : <Badge tone="warning">Visão · confirmar valores</Badge>}
            </div>

            <Card>
              <div className={styles.docCard}>
                <div className={styles.docPlaceholder} aria-hidden="true" />
                <div className={styles.docInfo}>
                  <div className={styles.fornecedorNome}>{atual.fornecedor?.nome ?? atual.nifFornecedor}</div>
                  <div className={styles.fornecedorMeta}>
                    NIF {atual.nifFornecedor} · {atual.numeroFatura} · {atual.dataFatura}
                  </div>
                </div>
              </div>

              {editando ? (
                <>
                  <div className={styles.editFields}>
                    <TextField label="Base tributável" value={baseTributavel} onChange={(e) => setBaseTributavel(e.target.value)} />
                    <TextField label="IVA" value={valorIva} onChange={(e) => setValorIva(e.target.value)} />
                    <TextField label="Total" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
                  </div>
                  <div className={styles.actions}>
                    <Button variant="primary" onClick={guardarValores}>Guardar</Button>
                    <Button variant="secondary" onClick={() => setEditando(false)}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <StatRow label="Base" value={`${atual.baseTributavel} €`} />
                  <StatRow label="IVA" value={`${atual.valorIva} €`} />
                  <StatRow label="Total" value={`${atual.valorTotal} €`} emphasized />
                </>
              )}
            </Card>

            <Card>
              <div className={styles.obraPanelHeader}>
                <Label>Atribuir {rotulos.singular.toLowerCase()}</Label>
                <div className={styles.searchWrap}>
                  <SearchInput value={procuraCentroCusto} onChange={setProcuraCentroCusto} />
                </div>
              </div>

              {sugestao && (
                <div className={styles.sugestao}>
                  <span>
                    Sugerida: {centrosCusto.find((c) => c.id === sugestao.centroCustoId)?.nome} — {sugestao.motivo}
                  </span>
                  <span>↵ aceita com Enter</span>
                </div>
              )}

              <div className={styles.obraGrid}>
                {centrosCustoFiltrados.map((c, i) => (
                  <ShortcutButton
                    key={c.id}
                    index={i + 1}
                    label={c.nome}
                    selected={centroCustoEscolhidoId === c.id}
                    onClick={() => setCentroCustoEscolhidoId(c.id)}
                  />
                ))}
              </div>
            </Card>

            <div className={styles.actions}>
              <Button variant="primary" shortcut="↵" onClick={confirmarAtual} disabled={!centroCustoEscolhidoId}>Confirmar</Button>
              <Button variant="secondary" shortcut="E" onClick={() => setEditando(true)}>Editar</Button>
              <Button variant="secondary" shortcut="S" onClick={adiarAtual}>Adiar</Button>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>Fila de revisão vazia.</div>
        )}

        <Card padding="sm">
          <Label>Total por {rotulos.singular.toLowerCase()}</Label>
          <div className={styles.totaisTitle} />
          {totais.map((t) => (
            <StatRow key={t.centroCusto.id} label={t.centroCusto.nome} value={`${t.total} €`} />
          ))}
        </Card>
      </div>
    </div>
  );
}
