import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { UTILIZADORES, CRIAR_UTILIZADOR, ELIMINAR_UTILIZADOR } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { ListRow } from "../ui/ListRow.js";
import { TextField } from "../ui/TextField.js";
import { Button } from "../ui/Button.js";
import styles from "./CentrosCustoScreen.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UtilizadoresScreen() {
  const { data, refetch } = useQuery(UTILIZADORES);
  const [criarUtilizador] = useMutation(CRIAR_UTILIZADOR);
  const [eliminarUtilizador] = useMutation(ELIMINAR_UTILIZADOR);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const utilizadores = data?.utilizadores ?? [];
  const emailSuspeito = email.length > 0 && !EMAIL_RE.test(email);

  async function submeterCriacao() {
    if (!nome.trim() || !email.trim()) return;
    await criarUtilizador({ variables: { input: { nome: nome.trim(), email: email.trim() } } });
    setNome("");
    setEmail("");
    await refetch();
  }

  async function confirmarEliminar(id: string) {
    try {
      await eliminarUtilizador({ variables: { id } });
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
      <div className={styles.title}>Utilizadores</div>

      <Card>
        <div className={styles.form}>
          <div className={styles.formField}>
            <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {emailSuspeito && <div className={styles.rowError}>Email pode estar incorreto</div>}
          </div>
          <Button variant="primary" onClick={submeterCriacao}>Criar</Button>
        </div>
      </Card>

      <Card padding="sm">
        {utilizadores.length === 0 && <div className={styles.empty}>Nenhum utilizador encontrado.</div>}
        {utilizadores.map((u) => (
          <div key={u.id}>
            <ListRow
              primary={u.nome}
              secondary={u.email}
              trailing={
                <div className={styles.actions}>
                  {confirmandoId === u.id ? (
                    <>
                      <Button variant="danger" onClick={() => confirmarEliminar(u.id)}>Confirmar</Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setConfirmandoId(u.id)}>Eliminar</Button>
                  )}
                </div>
              }
            />
            {erros[u.id] && <div className={styles.rowError}>{erros[u.id]}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}
