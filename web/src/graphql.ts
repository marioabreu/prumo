import { gql, type TypedDocumentNode } from "@apollo/client";

export interface Despesa {
  id: string;
  nifFornecedor: string;
  fornecedor: { nome: string | null } | null;
  numeroFatura: string;
  dataFatura: string;
  valorTotal: string;
  estado: "POR_REVER" | "CONFIRMADA" | "ADIADA";
}

export const FILA_REVISAO: TypedDocumentNode<{ filaRevisao: Despesa[] }> = gql`
  query FilaRevisao {
    filaRevisao(estado: POR_REVER) {
      id
      nifFornecedor
      fornecedor { nome }
      numeroFatura
      dataFatura
      valorTotal
      estado
    }
  }
`;

export interface SugestaoObra {
  obraId: string;
  motivo: string;
  score: number;
}

export const SUGESTAO_OBRA: TypedDocumentNode<
  { sugestaoObra: SugestaoObra | null }, { despesaId: string }
> = gql`
  query SugestaoObra($despesaId: ID!) {
    sugestaoObra(despesaId: $despesaId) { obraId motivo score }
  }
`;

export interface Obra {
  id: string;
  nome: string;
}

export const OBRAS: TypedDocumentNode<{ obras: Obra[] }> = gql`
  query Obras { obras { id nome } }
`;

export const ATRIBUIR_OBRA: TypedDocumentNode<
  { atribuirObra: { id: string; obra: Obra | null } }, { despesaId: string; obraId: string }
> = gql`
  mutation AtribuirObra($despesaId: ID!, $obraId: ID!) {
    atribuirObra(despesaId: $despesaId, obraId: $obraId) { id obra { id nome } }
  }
`;

export const CONFIRMAR: TypedDocumentNode<
  { confirmar: { id: string; estado: string } }, { despesaId: string }
> = gql`
  mutation Confirmar($despesaId: ID!) {
    confirmar(despesaId: $despesaId) { id estado }
  }
`;

export const ADIAR: TypedDocumentNode<
  { adiar: { id: string; estado: string } }, { despesaId: string }
> = gql`
  mutation Adiar($despesaId: ID!) {
    adiar(despesaId: $despesaId) { id estado }
  }
`;
