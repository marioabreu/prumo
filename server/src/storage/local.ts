import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Storage } from "./types.js";

export function criarStorageLocal(diretorio: string, baseUrl: string): Storage {
  return {
    async guardar(ficheiro: Buffer, nomeOriginal: string) {
      await mkdir(diretorio, { recursive: true });
      const nomeSeguro = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
      const nomeFicheiro = `${randomUUID()}-${nomeSeguro}`;
      await writeFile(path.join(diretorio, nomeFicheiro), ficheiro);
      return { url: `${baseUrl}/${nomeFicheiro}` };
    },
  };
}
