import jsQR from "jsqr";
import { qrParaDespesa, nifValido } from "./qr-fatura.js";
import type { Adaptadores, ResultadoExtracao } from "./types.js";

interface Overrides {
  /** Injetado nos testes; em produção chama jsqr sobre os pixels rasterizados. */
  lerQR?: (imagem: ImageData) => string | null;
}

export async function extrairFatura(
  ficheiro: ArrayBuffer,
  mime: string,
  adaptadores: Adaptadores,
  overrides: Overrides = {}
): Promise<ResultadoExtracao> {
  const paginas = await adaptadores.rasterizador.rasterizar(ficheiro, mime);
  const lerQR = overrides.lerQR ?? lerQRComJsqr;

  for (const pagina of paginas) {
    const qrRaw = lerQR(pagina);
    if (qrRaw) {
      const dados = qrParaDespesa(qrRaw);
      return { fonte: "qr", qrRaw, ...dados };
    }
  }

  // Nem todos os PDFs têm QR (recibos manuais, digitalizações) — fallback de visão.
  const dados = await adaptadores.visao.extrairDeImagem(paginas[0]);
  return {
    fonte: "visao",
    qrRaw: null,
    ...dados,
    nifValido: nifValido(dados.nifFornecedor),
  };
}

function lerQRComJsqr(imagem: ImageData): string | null {
  const resultado = jsQR(imagem.data, imagem.width, imagem.height);
  return resultado?.data ?? null;
}
