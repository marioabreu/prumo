import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { nifValido } from "@prumo/shared";
import { INGERIR_FATURA } from "../graphql.js";
import { Card } from "../ui/Card.js";
import { TextField } from "../ui/TextField.js";
import { Button } from "../ui/Button.js";
import styles from "./NovaDespesaTesteScreen.module.css";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function construirQR(input: {
  nif: string; numero: string; data: string; base: string; iva: string; total: string;
}): string {
  const dataCompacta = input.data.replaceAll("-", "");
  return [
    `A:${input.nif}`, `D:FT`, `F:${dataCompacta}`, `G:${input.numero}`,
    `I1:PT`, `I7:${input.base}`, `I8:${input.iva}`, `O:${input.total}`,
  ].join("*");
}

function somar(a: string, b: string): string {
  const total = Number(a || 0) + Number(b || 0);
  return Number.isFinite(total) ? total.toFixed(2) : "";
}

export function NovaDespesaTesteScreen() {
  const [ingerirFatura] = useMutation(INGERIR_FATURA);

  const [nif, setNif] = useState("");
  const [numero, setNumero] = useState("");
  const [data, setData] = useState(hoje());
  const [base, setBase] = useState("");
  const [iva, setIva] = useState("");
  const [total, setTotal] = useState("");
  const [totalManual, setTotalManual] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "aviso"; texto: string } | null>(null);

  const nifSuspeito = nif.length === 9 && !nifValido(nif);

  function atualizarBase(valor: string) {
    setBase(valor);
    if (!totalManual) setTotal(somar(valor, iva));
  }

  function atualizarIva(valor: string) {
    setIva(valor);
    if (!totalManual) setTotal(somar(base, valor));
  }

  function atualizarTotal(valor: string) {
    setTotal(valor);
    setTotalManual(true);
  }

  async function criar() {
    if (!nif.trim() || !numero.trim() || !data || !total) return;
    const qrRaw = construirQR({ nif: nif.trim(), numero: numero.trim(), data, base, iva, total });
    const { data: resultado } = await ingerirFatura({
      variables: { ficheiroUrl: "https://teste/manual", qrRaw },
    });
    if (resultado?.ingerirFatura.duplicada) {
      setMensagem({ tipo: "aviso", texto: `Já existe uma despesa com este NIF + número + data.` });
    } else {
      setMensagem({ tipo: "ok", texto: `Despesa criada (${resultado?.ingerirFatura.despesa.valorTotal} €).` });
      setNumero("");
      setTotalManual(false);
    }
  }

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.title}>Nova despesa (teste)</div>
        <div className={styles.hint}>
          Gera dados de teste sem precisar de uma fatura real: constrói um QR sintético e cria a
          despesa pelo mesmo caminho (ingerirFatura) que uma fatura verdadeira usaria.
        </div>
      </div>

      <Card>
        <div className={styles.fields}>
          <div>
            <TextField label="NIF" value={nif} onChange={(e) => setNif(e.target.value)} maxLength={9} />
            {nifSuspeito && <div className={styles.warning}>NIF pode estar incorreto (checksum inválido)</div>}
          </div>
          <TextField label="Número da fatura" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <TextField label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <TextField label="Base tributável" value={base} onChange={(e) => atualizarBase(e.target.value)} />
          <TextField label="IVA" value={iva} onChange={(e) => atualizarIva(e.target.value)} />
          <TextField label="Total" value={total} onChange={(e) => atualizarTotal(e.target.value)} />
        </div>

        <Button variant="primary" onClick={criar}>Criar despesa</Button>

        {mensagem && (
          <div className={mensagem.tipo === "ok" ? styles.feedbackOk : styles.feedbackWarn}>
            {mensagem.texto}
          </div>
        )}
      </Card>
    </div>
  );
}
