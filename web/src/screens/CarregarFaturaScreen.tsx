import { useState, type ChangeEvent } from "react";
import { useMutation } from "@apollo/client/react";
import { extrairFatura, type ResultadoExtracao } from "@prumo/shared";
import { INGERIR_FATURA } from "../graphql.js";
import { rasterizadorBrowser } from "../upload/rasterizadorBrowser.js";
import { visaoIndisponivel } from "../upload/visaoIndisponivel.js";
import { Card } from "../ui/Card.js";
import { Toast } from "../ui/Toast.js";
import { StatRow } from "../ui/StatRow.js";
import styles from "./CarregarFaturaScreen.module.css";

const extrairPadrao = (ficheiro: ArrayBuffer, mime: string): Promise<ResultadoExtracao> =>
  extrairFatura(ficheiro, mime, { rasterizador: rasterizadorBrowser, visao: visaoIndisponivel });

type Estado =
  | { fase: "idle" }
  | { fase: "processando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "sucesso"; duplicada: boolean; extraido: ResultadoExtracao };

export function CarregarFaturaScreen({
  extrair = extrairPadrao,
}: {
  extrair?: (ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>;
}) {
  const [ingerirFatura] = useMutation(INGERIR_FATURA);
  const [estado, setEstado] = useState<Estado>({ fase: "idle" });

  async function processarFicheiro(ficheiro: File) {
    setEstado({ fase: "processando" });
    try {
      const buffer = await ficheiro.arrayBuffer();
      const extraido = await extrair(buffer, ficheiro.type);
      if (!extraido.qrRaw) throw new Error("Não foi possível ler o QR desta fatura.");

      const formData = new FormData();
      formData.append("ficheiro", ficheiro);
      const respostaUpload = await fetch("http://localhost:4000/upload", { method: "POST", body: formData });
      if (!respostaUpload.ok) throw new Error("Falha ao enviar o ficheiro para o servidor.");
      const { url: ficheiroUrl } = await respostaUpload.json();

      const { data } = await ingerirFatura({ variables: { ficheiroUrl, qrRaw: extraido.qrRaw } });
      const resultado = data!.ingerirFatura;
      setEstado({ fase: "sucesso", duplicada: resultado.duplicada, extraido });
    } catch (e) {
      setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : "Erro desconhecido." });
    }
  }

  function aoEscolherFicheiro(e: ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (ficheiro) void processarFicheiro(ficheiro);
    e.target.value = "";
  }

  function fecharToast() {
    setEstado({ fase: "idle" });
  }

  return (
    <div className={styles.page}>
      <div className={styles.title}>Carregar Fatura</div>
      <Card>
        <label className={styles.dropzone}>
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={aoEscolherFicheiro} />
          Escolher ficheiro ou tirar foto
        </label>

        {estado.fase === "processando" && <p>A ler o QR da fatura...</p>}
      </Card>

      {estado.fase === "erro" && (
        <Toast tone="danger" title="Não foi possível ler a fatura" onClose={fecharToast}>
          <p className={styles.erro}>{estado.mensagem}</p>
        </Toast>
      )}

      {estado.fase === "sucesso" && (
        <Toast
          tone={estado.duplicada ? "warning" : "success"}
          title={estado.duplicada ? "Fatura já lida antes" : "Despesa criada"}
          onClose={fecharToast}
        >
          <StatRow label="Fornecedor (NIF)" value={estado.extraido.nifFornecedor} />
          <StatRow label="NIF válido" value={estado.extraido.nifValido ? "Sim" : "Não"} />
          <StatRow label="Número" value={estado.extraido.numeroFatura} />
          <StatRow label="Data" value={estado.extraido.dataFatura} />
          <StatRow label="Base tributável" value={`${estado.extraido.baseTributavel} €`} />
          <StatRow label="IVA" value={`${estado.extraido.valorIva} €`} />
          <StatRow label="Total" value={`${estado.extraido.valorTotal} €`} emphasized />
          <StatRow label="Origem da leitura" value={estado.extraido.fonte === "qr" ? "QR" : "Visão"} />
        </Toast>
      )}
    </div>
  );
}
