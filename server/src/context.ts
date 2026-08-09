import type { Repos } from "./repos/types.js";
import { criarLoaders, type Loaders } from "./loaders/index.js";
import { extrairFatura } from "@prumo/shared";
import type { Adaptadores, ResultadoExtracao } from "@prumo/shared";
import { criarPesquisarEmpresa, type PesquisarEmpresa } from "./pesquisa-empresa/pesquisar-empresa.js";

export interface GraphQLContext {
  repos: Repos;
  loaders: Loaders;
  extrair: (ficheiro: ArrayBuffer, mime: string) => Promise<ResultadoExtracao>;
  pesquisarEmpresa: PesquisarEmpresa;
}

export function criarContexto(
  repos: Repos,
  adaptadores: Adaptadores,
  pesquisarEmpresa: PesquisarEmpresa = criarPesquisarEmpresa()
): GraphQLContext {
  return {
    repos,
    loaders: criarLoaders(repos),
    extrair: (ficheiro, mime) => extrairFatura(ficheiro, mime, adaptadores),
    pesquisarEmpresa,
  };
}
