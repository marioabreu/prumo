import { useState, type ChangeEvent } from "react";
import { useMutation } from "@apollo/client/react";
import { extrairFatura, type ResultadoExtracao } from "@prumo/shared";
import { INGERIR_FATURA } from "../graphql.js";
import { rasterizadorBrowser } from "../upload/rasterizadorBrowser.js";
import { visaoIndisponivel } from "../upload/visaoIndisponivel.js";
import { Card } from "../ui/Card.js";
import styles from "./CarregarFaturaScreen.module.css";

const extrairPadrao = (ficheiro: ArrayBuffer, mime: string): Promise<ResultadoExtracao> =>
  extrairFatura(ficheiro, mime, { rasterizador: rasterizadorBrowser, visao: visaoIndisponivel });

type Estado =
  | { fase: "idle" }
  | { fase: "processando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "sucesso"; duplicada: boolean; numeroFatura: string; valorTotal: string };

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
      setEstado({
        fase: "sucesso", duplicada: resultado.duplicada,
        numeroFatura: resultado.despesa.numeroFatura, valorTotal: resultado.despesa.valorTotal,
      });
    } catch (e) {
      setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : "Erro desconhecido." });
    }
  }

  function aoEscolherFicheiro(e: ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (ficheiro) void processarFicheiro(ficheiro);
    e.target.value = "";
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
        {estado.fase === "erro" && <p className={styles.erro}>{estado.mensagem}</p>}
        {estado.fase === "sucesso" && !estado.duplicada && (
          <p className={styles.sucesso}>Despesa criada: {estado.numeroFatura} — {estado.valorTotal} €</p>
        )}
        {estado.fase === "sucesso" && estado.duplicada && (
          <p className={styles.aviso}>Esta fatura já tinha sido lida antes ({estado.numeroFatura}).</p>
        )}
      </Card>
    </div>
  );
}
