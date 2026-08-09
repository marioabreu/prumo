export interface ResultadoExtracao {
  fonte: "qr" | "visao";
  qrRaw: string | null;
  nifFornecedor: string;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string;
  valorIva: string;
  valorTotal: string;
  nifValido: boolean;
}

/** Rasteriza um PDF/imagem para pixels RGBA por página — implementação varia entre browser e Node. */
export interface RasterizadorAdapter {
  rasterizar(ficheiro: ArrayBuffer, mime: string): Promise<ImageData[]>;
}

/** Fallback quando não há QR legível — chama um modelo de visão (Claude/GPT-4o). */
export interface VisaoAdapter {
  extrairDeImagem(imagem: ImageData): Promise<Omit<ResultadoExtracao, "fonte" | "qrRaw" | "nifValido">>;
}

export interface Adaptadores {
  rasterizador: RasterizadorAdapter;
  visao: VisaoAdapter;
}
