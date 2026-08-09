import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { nifValido } from "@prumo/shared";
import { FORNECEDORES, CRIAR_FORNECEDOR, ELIMINAR_FORNECEDOR } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { ListRow } from "../ui/ListRow.js";
import { TextField } from "../ui/TextField.js";
import { Button } from "../ui/Button.js";
import styles from "./ObrasScreen.module.css";

export function FornecedoresScreen() {
  const { data, refetch } = useQuery(FORNECEDORES);
  const [criarFornecedor] = useMutation(CRIAR_FORNECEDOR);
  const [eliminarFornecedor] = useMutation(ELIMINAR_FORNECEDOR);

  const [nif, setNif] = useState("");
  const [nome, setNome] = useState("");
  const [morada, setMorada] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const fornecedores = data?.fornecedores ?? [];
  const nifCompleto = nif.length === 9;
  const nifSuspeito = nifCompleto && !nifValido(nif);

  async function submeterCriacao() {
    if (!nif.trim()) return;
    await criarFornecedor({ variables: { input: { nif: nif.trim(), nome, morada } } });
    setNif("");
    setNome("");
    setMorada("");
    await refetch();
  }

  async function confirmarEliminar(id: string) {
    try {
      await eliminarFornecedor({ variables: { id } });
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
      <div className={styles.title}>Fornecedores</div>

      <Card>
        <div className={styles.form}>
          <div className={styles.formField}>
            <TextField label="NIF" value={nif} onChange={(e) => setNif(e.target.value)} maxLength={9} />
            {nifSuspeito && <div className={styles.rowError}>NIF pode estar incorreto (checksum inválido)</div>}
          </div>
          <div className={styles.formField}>
            <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className={styles.formField}>
            <TextField label="Morada" value={morada} onChange={(e) => setMorada(e.target.value)} />
          </div>
          <Button variant="primary" onClick={submeterCriacao}>Criar</Button>
        </div>
      </Card>

      <Card padding="sm">
        {fornecedores.length === 0 && <div className={styles.empty}>Nenhum fornecedor encontrado.</div>}
        {fornecedores.map((f) => (
          <div key={f.id}>
            <ListRow
              primary={f.nome ?? f.nif}
              secondary={f.nome ? f.nif : (f.morada ?? undefined)}
              trailing={
                <div className={styles.actions}>
                  {confirmandoId === f.id ? (
                    <>
                      <Button variant="danger" onClick={() => confirmarEliminar(f.id)}>Confirmar</Button>
                      <Button variant="secondary" onClick={() => setConfirmandoId(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setConfirmandoId(f.id)}>Eliminar</Button>
                  )}
                </div>
              }
            />
            {erros[f.id] && <div className={styles.rowError}>{erros[f.id]}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}
