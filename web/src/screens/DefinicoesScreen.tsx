import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import {
  FUNCIONALIDADES, ATUALIZAR_FUNCIONALIDADE, ROTULOS_CENTRO_CUSTO, ATUALIZAR_ROTULOS_CENTRO_CUSTO,
} from "../graphql.js";
import { Card } from "../ui/Card.js";
import { Toggle } from "../ui/Toggle.js";
import { TextField } from "../ui/TextField.js";
import { Button } from "../ui/Button.js";
import styles from "./DefinicoesScreen.module.css";

export function DefinicoesScreen() {
  const { data, refetch } = useQuery(FUNCIONALIDADES, { fetchPolicy: "cache-and-network" });
  const [atualizarFuncionalidade] = useMutation(ATUALIZAR_FUNCIONALIDADE);

  const { data: rotulosData } = useQuery(ROTULOS_CENTRO_CUSTO, { fetchPolicy: "cache-and-network" });
  const [atualizarRotulos] = useMutation(ATUALIZAR_ROTULOS_CENTRO_CUSTO);
  const [singular, setSingular] = useState("");
  const [plural, setPlural] = useState("");
  const [rotuloGuardado, setRotuloGuardado] = useState(false);

  const funcionalidades = data?.funcionalidades ?? [];

  useEffect(() => {
    if (!rotulosData) return;
    setSingular(rotulosData.rotulosCentroCusto.singular);
    setPlural(rotulosData.rotulosCentroCusto.plural);
    // dependência nos campos primitivos, não no objeto rotulosCentroCusto — o objeto
    // muda de referência a cada leitura da cache mesmo com o mesmo conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotulosData?.rotulosCentroCusto.singular, rotulosData?.rotulosCentroCusto.plural]);

  async function alternar(chave: string, ativa: boolean) {
    await atualizarFuncionalidade({ variables: { chave, ativa } });
    await refetch();
  }

  async function guardarRotulos() {
    if (!singular.trim() || !plural.trim()) return;
    await atualizarRotulos({ variables: { singular: singular.trim(), plural: plural.trim() } });
    setRotuloGuardado(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.title}>Definições</div>

      <div>
        <div className={styles.sectionTitle}>Nome da entidade</div>
        <Card padding="sm">
          <div className={styles.row}>
            <TextField label="Singular" value={singular} onChange={(e) => { setSingular(e.target.value); setRotuloGuardado(false); }} />
            <TextField label="Plural" value={plural} onChange={(e) => { setPlural(e.target.value); setRotuloGuardado(false); }} />
            <Button variant="primary" onClick={guardarRotulos}>Guardar rótulo</Button>
          </div>
          {rotuloGuardado && <div className={styles.empty}>Rótulo guardado.</div>}
        </Card>
      </div>

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
