import { useQuery } from "@apollo/client/react";
import { FUNCIONALIDADES } from "../graphql.js";

/** Feature flag: false por defeito, inclusive enquanto a query ainda não respondeu. */
export function useFuncionalidade(chave: string): boolean {
  const { data } = useQuery(FUNCIONALIDADES);
  return data?.funcionalidades.find((f) => f.chave === chave)?.ativa ?? false;
}
