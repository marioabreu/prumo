import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { OBRAS, CRIAR_OBRA, ATUALIZAR_OBRA, ELIMINAR_OBRA } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { ListRow } from "../ui/ListRow.js";
import { TextField } from "../ui/TextField.js";
import { Toggle } from "../ui/Toggle.js";
import { Button } from "../ui/Button.js";
import styles from "./ObrasScreen.module.css";

export function ObrasScreen() {
  const { data, refetch } = useQuery(OBRAS);
  const [criarObra] = useMutation(CRIAR_OBRA);
  const [atualizarObra] = useMutation(ATUALIZAR_OBRA);
  const [eliminarObra] = useMutation(ELIMINAR_OBRA);

  const [nome, setNome] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const obras = data?.obras ?? [];

  async function submeterCriacao() {
    if (!nome.trim()) return;
    await criarObra({ variables: { input: { nome: nome.trim(), ativa } } });
    setNome("");
    setAtiva(true);
    await refetch();
  }

  async function alternarAtiva(id: string, ativaAtual: boolean) {
    await atualizarObra({ variables: { id, input: { ativa: !ativaAtual } } });
    await refetch();
  }

  async function confirmarEliminar(id: string) {
    try {
      await eliminarObra({ variables: { id } });
      setConfirmandoId(null);
      setErros((prev) => { const { [id]: _removido, ...resto } = prev; return resto; });
      await refetch();
    } catch (e) {
      setConfirmandoId(null);
      setErros((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : "Erro ao eliminar" }));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.title}>Obras</div>

      <Card>
        <div className={styles.form}>
          <div className={styles.formField}>
            <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Toggle label="Ativa" checked={ativa} onChange={setAtiva} />
          <Button variant="primary" onClick={submeterCriacao}>Criar</Button>
        </div>
      </Card>

      <Card padding="sm">
        {obras.length === 0 && <div className={styles.empty}>Nenhuma obra encontrada.</div>}
        {obras.map((obra) => (
          <div key={obra.id}>
            <ListRow
              primary={obra.nome}
              secondary={obra.ativa ? "Ativa" : "Inativa"}
              tone={obra.ativa ? "active" : "inactive"}
              trailing={
                <div className={styles.actions}>
                  {confirmandoId === obra.id ? (
                    <>
                      <Button variant="danger" onClick={() => confirmarEliminar(obra.id)}>Confirmar</Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => alternarAtiva(obra.id, obra.ativa)}>
                        {obra.ativa ? "Desativar" : "Ativar"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(obra.id)}>Eliminar</Button>
                    </>
                  )}
                </div>
              }
            />
            {erros[obra.id] && <div className={styles.rowError}>{erros[obra.id]}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}
