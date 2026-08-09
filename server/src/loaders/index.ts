import DataLoader from "dataloader";
import type { Repos } from "../repos/types.js";

export function criarLoaders(repos: Repos) {
  return {
    obraPorId: new DataLoader(async (ids: readonly string[]) => {
      const resultados = await Promise.all(ids.map((id) => repos.obras.obterPorId(id)));
      return resultados;
    }),
    fornecedorPorNif: new DataLoader(async (nifs: readonly string[]) => {
      const resultados = await Promise.all(nifs.map((nif) => repos.fornecedores.obterPorNif(nif)));
      return resultados;
    }),
  };
}

export type Loaders = ReturnType<typeof criarLoaders>;
