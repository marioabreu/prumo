import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  TAREFAS, CRIAR_TAREFA, ATUALIZAR_TAREFA, ELIMINAR_TAREFA, ELIMINAR_TAREFAS_FEITAS, type Tarefa,
} from "../graphql.js";
import { Card } from "../ui/Card.js";
import { TextField } from "../ui/TextField.js";
import { Button } from "../ui/Button.js";
import styles from "./TarefasScreen.module.css";

export function TarefasScreen() {
  const { data, refetch } = useQuery(TAREFAS, { fetchPolicy: "cache-and-network" });
  const [criarTarefa] = useMutation(CRIAR_TAREFA);
  const [atualizarTarefa] = useMutation(ATUALIZAR_TAREFA);
  const [eliminarTarefa] = useMutation(ELIMINAR_TAREFA);
  const [eliminarTarefasFeitas] = useMutation(ELIMINAR_TAREFAS_FEITAS);

  const [novoTexto, setNovoTexto] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicaoTexto, setEdicaoTexto] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [confirmandoFeitas, setConfirmandoFeitas] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const tarefas = data?.tarefas ?? [];
  const existemFeitas = tarefas.some((t) => t.feita);

  async function adicionar() {
    if (!novoTexto.trim()) return;
    await criarTarefa({ variables: { input: { texto: novoTexto.trim() } } });
    setNovoTexto("");
    await refetch();
  }

  async function alternarFeita(t: Tarefa) {
    await atualizarTarefa({ variables: { id: t.id, input: { feita: !t.feita } } });
    await refetch();
  }

  function iniciarEdicao(t: Tarefa) {
    setEditandoId(t.id);
    setEdicaoTexto(t.texto);
  }

  async function guardarEdicao(id: string) {
    if (!edicaoTexto.trim()) return;
    try {
      await atualizarTarefa({ variables: { id, input: { texto: edicaoTexto.trim() } } });
      setEditandoId(null);
      setErros((prev) => { const { [id]: _removido, ...resto } = prev; return resto; });
      await refetch();
    } catch (e) {
      setErros((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Erro ao guardar" }));
    }
  }

  async function confirmarEliminar(id: string) {
    try {
      await eliminarTarefa({ variables: { id } });
      setConfirmandoId(null);
      setErros((prev) => { const { [id]: _removido, ...resto } = prev; return resto; });
      await refetch();
    } catch (e) {
      setConfirmandoId(null);
      setErros((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Erro ao eliminar" }));
    }
  }

  async function confirmarEliminarFeitas() {
    await eliminarTarefasFeitas();
    setConfirmandoFeitas(false);
    await refetch();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Tarefas</div>
        {existemFeitas && (
          <div className={styles.actions}>
            {confirmandoFeitas ? (
              <>
                <Button variant="danger" onClick={confirmarEliminarFeitas}>Confirmar</Button>
                <Button variant="secondary" onClick={() => setConfirmandoFeitas(false)}>Cancelar</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmandoFeitas(true)}>Eliminar concluídas</Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <div className={styles.form}>
          <div className={styles.formField}>
            <TextField
              label="Nova tarefa"
              value={novoTexto}
              onChange={(e) => setNovoTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
            />
          </div>
          <Button variant="primary" onClick={adicionar}>Adicionar</Button>
        </div>
      </Card>

      <Card padding="sm">
        {tarefas.length === 0 && <div className={styles.empty}>Nenhuma tarefa por aqui.</div>}
        {tarefas.map((t) =>
          editandoId === t.id ? (
            <div key={t.id} className={styles.form}>
              <div className={styles.formField}>
                <TextField label="Texto" value={edicaoTexto} onChange={(e) => setEdicaoTexto(e.target.value)} />
              </div>
              <Button variant="primary" onClick={() => guardarEdicao(t.id)}>Guardar</Button>
              <Button variant="secondary" onClick={() => setEditandoId(null)}>Cancelar</Button>
              {erros[t.id] && <div className={styles.rowError}>{erros[t.id]}</div>}
            </div>
          ) : (
            <div key={t.id}>
              <div className={styles.row}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={t.feita}
                  onChange={() => alternarFeita(t)}
                  aria-label={`Marcar "${t.texto}" como ${t.feita ? "por fazer" : "feita"}`}
                />
                <span className={t.feita ? styles.textoFeito : styles.texto}>{t.texto}</span>
                <div className={styles.actions}>
                  {confirmandoId === t.id ? (
                    <>
                      <Button variant="danger" onClick={() => confirmarEliminar(t.id)}>Confirmar</Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => iniciarEdicao(t)}>Editar</Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(t.id)}>Eliminar</Button>
                    </>
                  )}
                </div>
              </div>
              {erros[t.id] && <div className={styles.rowError}>{erros[t.id]}</div>}
            </div>
          )
        )}
      </Card>
    </div>
  );
}
