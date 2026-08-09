import type { Repos } from "./repos/types.js";
import { criarLoaders, type Loaders } from "./loaders/index.js";
import { extrairFatura } from "@prumo/shared";
import type { Adaptadores, ResultadoExtracao } from "@prumo/shared";

export interface GraphQLContext {
  repos: Repos;
  loaders: Loaders;
  extrair: (ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>;
}

export function criarContexto(repos: Repos, adaptadores: Adaptadores): GraphQLContext {
  return {
    repos,
    loaders: criarLoaders(repos),
    extrair: (ficheiro, mime) => extrairFatura(ficheiro, mime, adaptadores),
  };
}
