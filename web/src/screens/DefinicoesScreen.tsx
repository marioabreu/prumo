import { useQuery, useMutation } from "@apollo/client/react";
import { FUNCIONALIDADES, ATUALIZAR_FUNCIONALIDADE } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { Toggle } from "../ui/Toggle.js";
import styles from "./DefinicoesScreen.module.css";

export function DefinicoesScreen() {
  const { data, refetch } = useQuery(FUNCIONALIDADES, { fetchPolicy: "cache-and-network" });
  const [atualizarFuncionalidade] = useMutation(ATUALIZAR_FUNCIONALIDADE);

  const funcionalidades = data?.funcionalidades ?? [];

  async function alternar(chave: string, ativa: boolean) {
    await atualizarFuncionalidade({ variables: { chave, ativa } });
    await refetch();
  }

  return (
    <div className={styles.page}>
      <div className={styles.title}>Definições</div>

      <div>
        <div className={styles.sectionTitle}>Funcionalidades em desenvolvimento</div>
        <Card padding="sm">
          {funcionalidades.length === 0 && (
            <div className={styles.empty}>Nenhuma funcionalidade a ligar/desligar de momento.</div>
          )}
          {funcionalidades.map((f) => (
            <div key={f.id} className={styles.row}>
              <Toggle label={f.nome} checked={f.ativa} onChange={(ativa) => alternar(f.chave, ativa)} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
