import { useQuery } from "@apollo/client/react";
import { ROTULOS_CENTRO_CUSTO, type RotulosCentroCusto } from "../graphql.js";

const DEFEITO: RotulosCentroCusto = { singular: "Obra", plural: "Obras" };

/** Rótulo de UI configurável em Definições — usar em vez de texto fixo "Obra"/"Obras". */
export function useRotulosCentroCusto(): RotulosCentroCusto {
  const { data } = useQuery(ROTULOS_CENTRO_CUSTO, { fetchPolicy: "cache-and-network" });
  return data?.rotulosCentroCusto ?? DEFEITO;
}
