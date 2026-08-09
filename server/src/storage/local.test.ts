import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { criarStorageLocal } from "./local.js";

describe("criarStorageLocal", () => {
  let diretorio: string;

  afterEach(async () => {
    if (diretorio) await rm(diretorio, { recursive: true, force: true });
  });

  it("grava o ficheiro em disco e devolve um URL derivado do baseUrl", async () => {
    diretorio = await mkdtemp(path.join(tmpdir(), "prumo-storage-"));
    const storage = criarStorageLocal(diretorio, "http://localhost:4000/files");

    const { url } = await storage.guardar(Buffer.from("conteudo de teste"), "fatura.pdf", "application/pdf");

    expect(url).toMatch(/^http:\/\/localhost:4000\/files\/[0-9a-f-]{36}-fatura\.pdf$/);
    const nomeFicheiro = url.split("/").pop()!;
    const conteudo = await readFile(path.join(diretorio, nomeFicheiro), "utf-8");
    expect(conteudo).toBe("conteudo de teste");
  });

  it("sanitiza o nome do ficheiro de forma a nunca sair do diretorio de destino", async () => {
    diretorio = await mkdtemp(path.join(tmpdir(), "prumo-storage-"));
    const storage = criarStorageLocal(diretorio, "http://localhost:4000/files");

    const { url } = await storage.guardar(Buffer.from("x"), "../../etc/passwd", "text/plain");
    const nomeFicheiro = url.split("/").pop()!;
    const caminhoResolvido = path.resolve(diretorio, nomeFicheiro);

    expect(caminhoResolvido.startsWith(path.resolve(diretorio) + path.sep)).toBe(true);
  });
});
