import type { RasterizadorAdapter } from "@prumo/shared";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function rasterizarImagem(ficheiro: ArrayBuffer): Promise<ImageData[]> {
  const bitmap = await createImageBitmap(new Blob([ficheiro]));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return [ctx.getImageData(0, 0, canvas.width, canvas.height)];
}

async function rasterizarPdf(ficheiro: ArrayBuffer): Promise<ImageData[]> {
  const documento = await pdfjsLib.getDocument({ data: ficheiro }).promise;
  const paginas: ImageData[] = [];
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    paginas.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }
  return paginas;
}

export const rasterizadorBrowser: RasterizadorAdapter = {
  async rasterizar(ficheiro, mime) {
    return mime === "application/pdf" ? rasterizarPdf(ficheiro) : rasterizarImagem(ficheiro);
  },
};
