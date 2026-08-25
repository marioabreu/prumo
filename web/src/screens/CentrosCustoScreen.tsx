import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { CENTROS_CUSTO, CRIAR_CENTRO_CUSTO, ATUALIZAR_CENTRO_CUSTO, ELIMINAR_CENTRO_CUSTO } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { ListRow } from "../ui/ListRow.js";
import { TextField } from "../ui/TextField.js";
import { Toggle } from "../ui/Toggle.js";
import { Button } from "../ui/Button.js";
import { useRotulosCentroCusto } from "../ui/useRotulosCentroCusto.js";
import styles from "./CentrosCustoScreen.module.css";

export function CentrosCustoScreen() {
  const rotulos = useRotulosCentroCusto();
  const { data, refetch } = useQuery(CENTROS_CUSTO);
  const [criarCentroCusto] = useMutation(CRIAR_CENTRO_CUSTO);
  const [atualizarCentroCusto] = useMutation(ATUALIZAR_CENTRO_CUSTO);
  const [eliminarCentroCusto] = useMutation(ELIMINAR_CENTRO_CUSTO);

  const [nome, setNome] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const centrosCusto = data?.centrosCusto ?? [];

  async function submeterCriacao() {
    if (!nome.trim()) return;
    await criarCentroCusto({ variables: { input: { nome: nome.trim(), ativa } } });
    setNome("");
    setAtiva(true);
    await refetch();
  }

  async function alternarAtiva(id: string, ativaAtual: boolean) {
    await atualizarCentroCusto({ variables: { id, input: { ativa: !ativaAtual } } });
    await refetch();
  }

  async function confirmarEliminar(id: string) {
    try {
      await eliminarCentroCusto({ variables: { id } });
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
      <div className={styles.title}>{rotulos.plural}</div>

      <Card>
        <div className={styles.form}>
          <div className={styles.formField}>
            <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Toggle label="Ativa" checked={ativa} onChange={setAtiva} />
          <Button variant="primary" onClick={submeterCriacao}>Criar {rotulos.singular}</Button>
        </div>
      </Card>

      <Card padding="sm">
        {centrosCusto.length === 0 && <div className={styles.empty}>Sem {rotulos.plural.toLowerCase()} ainda.</div>}
        {centrosCusto.map((centroCusto) => (
          <div key={centroCusto.id}>
            <ListRow
              primary={centroCusto.nome}
              secondary={centroCusto.ativa ? "Ativa" : "Inativa"}
              tone={centroCusto.ativa ? "active" : "inactive"}
              trailing={
                <div className={styles.actions}>
                  {confirmandoId === centroCusto.id ? (
                    <>
                      <Button variant="danger" onClick={() => confirmarEliminar(centroCusto.id)}>Confirmar</Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => alternarAtiva(centroCusto.id, centroCusto.ativa)}>
                        {centroCusto.ativa ? "Desativar" : "Ativar"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(centroCusto.id)}>Eliminar</Button>
                    </>
                  )}
                </div>
              }
            />
            {erros[centroCusto.id] && <div className={styles.rowError}>{erros[centroCusto.id]}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}
