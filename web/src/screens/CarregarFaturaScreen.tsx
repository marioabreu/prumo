import { useState, type ChangeEvent } from "react";
import { useMutation } from "@apollo/client/react";
import { extrairFatura, type ResultadoExtracao } from "@prumo/shared";
import { INGERIR_FATURA } from "../graphql.js";
import { rasterizadorBrowser } from "../upload/rasterizadorBrowser.js";
import { visaoIndisponivel } from "../upload/visaoIndisponivel.js";
import { Card } from "../ui/Card.js";
import { Toast } from "../ui/Toast.js";
import { ToastStack } from "../ui/ToastStack.js";
import { StatRow } from "../ui/StatRow.js";
import styles from "./CarregarFaturaScreen.module.css";

const extrairPadrao = (ficheiro: ArrayBuffer, mime: string): Promise<ResultadoExtracao> =>
  extrairFatura(ficheiro, mime, { rasterizador: rasterizadorBrowser, visao: visaoIndisponivel });

type ItemProcessamento =
  | { id: string; nomeFicheiro: string; fase: "processando" }
  | { id: string; nomeFicheiro: string; fase: "erro"; mensagem: string }
  | { id: string; nomeFicheiro: string; fase: "sucesso"; duplicada: boolean; extraido: ResultadoExtracao };

type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never;
type PatchItem = DistributiveOmit<ItemProcessamento, "id" | "nomeFicheiro">;

export function CarregarFaturaScreen({
  extrair = extrairPadrao,
}: {
  extrair?: (ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>;
}) {
  const [ingerirFatura] = useMutation(INGERIR_FATURA);
  const [itens, setItens] = useState<ItemProcessamento[]>([]);

  function atualizarItem(id: string, patch: PatchItem) {
    setItens((atual) => atual.map((item) => (item.id === id ? ({ ...item, ...patch } as ItemProcessamento) : item)));
  }

  async function processarFicheiro(id: string, ficheiro: File) {
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
      atualizarItem(id, { fase: "sucesso", duplicada: resultado.duplicada, extraido });
    } catch (e) {
      atualizarItem(id, { fase: "erro", mensagem: e instanceof Error ? e.message : "Erro desconhecido." });
    }
  }

  async function processarFicheiros(ficheiros: File[]) {
    const novosItens: ItemProcessamento[] = ficheiros.map((ficheiro) => ({
      id: crypto.randomUUID(),
      nomeFicheiro: ficheiro.name,
      fase: "processando",
    }));
    setItens((atual) => [...atual, ...novosItens]);

    for (let i = 0; i < ficheiros.length; i++) {
      await processarFicheiro(novosItens[i].id, ficheiros[i]);
    }
  }

  function aoEscolherFicheiros(e: ChangeEvent<HTMLInputElement>) {
    const ficheiros = Array.from(e.target.files ?? []);
    if (ficheiros.length > 0) void processarFicheiros(ficheiros);
    e.target.value = "";
  }

  function fecharToast(id: string) {
    setItens((atual) => atual.filter((item) => item.id !== id));
  }

  const aProcessar = itens.some((item) => item.fase === "processando");

  return (
    <div className={styles.page}>
      <div className={styles.title}>Carregar Fatura</div>
      <Card>
        <label className={styles.dropzone}>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            capture="environment"
            onChange={aoEscolherFicheiros}
          />
          Escolher ficheiro ou tirar foto
        </label>

        {aProcessar && <p>A ler fatura(s)...</p>}
      </Card>

      <ToastStack>
        {itens
          .filter((item) => item.fase !== "processando")
          .map((item) =>
            item.fase === "erro" ? (
              <Toast key={item.id} tone="danger" title={`Não foi possível ler: ${item.nomeFicheiro}`} onClose={() => fecharToast(item.id)}>
                <p className={styles.erro}>{item.mensagem}</p>
              </Toast>
            ) : (
              <Toast
                key={item.id}
                tone={item.duplicada ? "warning" : "success"}
                title={item.duplicada ? `Fatura já lida antes: ${item.nomeFicheiro}` : "Despesa criada"}
                onClose={() => fecharToast(item.id)}
              >
                <StatRow label="Fornecedor (NIF)" value={item.extraido.nifFornecedor} />
                <StatRow label="NIF válido" value={item.extraido.nifValido ? "Sim" : "Não"} />
                <StatRow label="Número" value={item.extraido.numeroFatura} />
                <StatRow label="Data" value={item.extraido.dataFatura} />
                <StatRow label="Base tributável" value={`${item.extraido.baseTributavel} €`} />
                <StatRow label="IVA" value={`${item.extraido.valorIva} €`} />
                <StatRow label="Total" value={`${item.extraido.valorTotal} €`} emphasized />
                <StatRow label="Origem da leitura" value={item.extraido.fonte === "qr" ? "QR" : "Visão"} />
              </Toast>
            )
          )}
      </ToastStack>
    </div>
  );
}
