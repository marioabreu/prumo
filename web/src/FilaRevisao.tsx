import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  FILA_REVISAO, SUGESTAO_OBRA, OBRAS, TOTAIS_POR_OBRA,
  ATRIBUIR_OBRA, CONFIRMAR, ADIAR, ATUALIZAR_VALORES,
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
import styles from "./FilaRevisao.module.css";

export function FilaRevisao() {
  const { data, refetch } = useQuery(FILA_REVISAO);
  const { data: obrasData } = useQuery(OBRAS);
  const { data: totaisData } = useQuery(TOTAIS_POR_OBRA);
  const [atribuirObra] = useMutation(ATRIBUIR_OBRA);
  const [confirmar] = useMutation(CONFIRMAR);
  const [adiar] = useMutation(ADIAR);
  const [atualizarValores] = useMutation(ATUALIZAR_VALORES);

  const fila = data?.filaRevisao ?? [];
  const atual = fila[0];
  const obras = obrasData?.obras ?? [];
  const totais = totaisData?.totaisPorObra ?? [];

  const { data: sugestaoData } = useQuery(SUGESTAO_OBRA, {
    variables: { despesaId: atual?.id ?? "" },
    skip: !atual,
  });
  const sugestao = sugestaoData?.sugestaoObra ?? null;

  const [obraEscolhidaId, setObraEscolhidaId] = useState<string | null>(null);
  const [procuraObra, setProcuraObra] = useState("");
  const [editando, setEditando] = useState(false);
  const [baseTributavel, setBaseTributavel] = useState("");
  const [valorIva, setValorIva] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [confirmadas, setConfirmadas] = useState(0);

  useEffect(() => {
    setObraEscolhidaId(sugestao?.obraId ?? null);
    // dependência em sugestao?.obraId (primitivo), não no objeto sugestao — o objeto
    // muda de referência a cada leitura da cache mesmo com o mesmo conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestao?.obraId, atual?.id]);

  useEffect(() => {
    setEditando(false);
    setProcuraObra("");
  }, [atual?.id]);

  useEffect(() => {
    if (!atual) return;
    setBaseTributavel(atual.baseTributavel);
    setValorIva(atual.valorIva);
    setValorTotal(atual.valorTotal);
  }, [atual]);

  const obrasFiltradas = obras.filter((o) => o.nome.toLowerCase().includes(procuraObra.toLowerCase()));

  async function confirmarAtual() {
    if (!atual || !obraEscolhidaId) return;
    await atribuirObra({ variables: { despesaId: atual.id, obraId: obraEscolhidaId } });
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
        const obra = obrasFiltradas[Number(e.key) - 1];
        if (obra) setObraEscolhidaId(obra.id);
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
          { keys: "1–9", action: "atribuir obra" },
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
                <Label>Atribuir obra</Label>
                <div className={styles.searchWrap}>
                  <SearchInput value={procuraObra} onChange={setProcuraObra} />
                </div>
              </div>

              {sugestao && (
                <div className={styles.sugestao}>
                  <span>Sugerida: {obras.find((o) => o.id === sugestao.obraId)?.nome} — {sugestao.motivo}</span>
                  <span>↵ aceita com Enter</span>
                </div>
              )}

              <div className={styles.obraGrid}>
                {obrasFiltradas.map((o, i) => (
                  <ShortcutButton
                    key={o.id}
                    index={i + 1}
                    label={o.nome}
                    selected={obraEscolhidaId === o.id}
                    onClick={() => setObraEscolhidaId(o.id)}
                  />
                ))}
              </div>
            </Card>

            <div className={styles.actions}>
              <Button variant="primary" shortcut="↵" onClick={confirmarAtual} disabled={!obraEscolhidaId}>Confirmar</Button>
              <Button variant="secondary" shortcut="E" onClick={() => setEditando(true)}>Editar</Button>
              <Button variant="secondary" shortcut="S" onClick={adiarAtual}>Adiar</Button>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>Fila de revisão vazia.</div>
        )}

        <Card padding="sm">
          <Label>Total por obra</Label>
          <div className={styles.totaisTitle} />
          {totais.map((t) => (
            <StatRow key={t.obra.id} label={t.obra.nome} value={`${t.total} €`} />
          ))}
        </Card>
      </div>
    </div>
  );
}
