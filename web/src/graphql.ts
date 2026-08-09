import { gql, type TypedDocumentNode } from "@apollo/client";

export type EstadoDespesa = "POR_REVER" | "CONFIRMADA" | "ADIADA";

export interface Despesa {
  id: string;
  nifFornecedor: string;
  fornecedor: { nome: string | null } | null;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string;
  valorIva: string;
  valorTotal: string;
  qrRaw: string | null;
  estado: EstadoDespesa;
}

export const FILA_REVISAO: TypedDocumentNode<{ filaRevisao: Despesa[] }> = gql`
  query FilaRevisao {
    filaRevisao(estado: POR_REVER) {
      id
      nifFornecedor
      fornecedor { nome }
      numeroFatura
      dataFatura
      baseTributavel
      valorIva
      valorTotal
      qrRaw
      estado
    }
  }
`;

export interface TotalObra {
  obra: { id: string; nome: string };
  total: string;
}

export const TOTAIS_POR_OBRA: TypedDocumentNode<{ totaisPorObra: TotalObra[] }> = gql`
  query TotaisPorObra {
    totaisPorObra {
      obra { id nome }
      total
    }
  }
`;

export interface DespesaDetalhe extends Despesa {
  fornecedor: { nome: string | null } | null;
  baseTributavel: string;
  valorIva: string;
  ficheiroUrl: string;
  qrRaw: string | null;
  origem: "UPLOAD" | "EMAIL";
  obra: { id: string; nome: string } | null;
}

export const DESPESAS: TypedDocumentNode<
  { despesas: Despesa[] }, { estado?: EstadoDespesa; obraId?: string }
> = gql`
  query Despesas($estado: EstadoDespesa, $obraId: ID) {
    despesas(estado: $estado, obraId: $obraId) {
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

export const DESPESA: TypedDocumentNode<{ despesa: DespesaDetalhe | null }, { id: string }> = gql`
  query Despesa($id: ID!) {
    despesa(id: $id) {
      id
      nifFornecedor
      fornecedor { nome }
      numeroFatura
      dataFatura
      baseTributavel
      valorIva
      valorTotal
      ficheiroUrl
      qrRaw
      origem
      obra { id nome }
      estado
    }
  }
`;

export interface AtualizarValoresInput {
  baseTributavel?: string;
  valorIva?: string;
  valorTotal?: string;
}

export const ATUALIZAR_VALORES: TypedDocumentNode<
  { atualizarValores: DespesaDetalhe }, { despesaId: string; input: AtualizarValoresInput }
> = gql`
  mutation AtualizarValores($despesaId: ID!, $input: AtualizarValoresInput!) {
    atualizarValores(despesaId: $despesaId, input: $input) {
      id
      baseTributavel
      valorIva
      valorTotal
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
  ativa: boolean;
}

export const OBRAS: TypedDocumentNode<{ obras: Obra[] }> = gql`
  query Obras { obras { id nome ativa } }
`;

export interface CriarObraInput {
  nome: string;
  ativa?: boolean;
}

export interface AtualizarObraInput {
  nome?: string;
  ativa?: boolean;
}

export const CRIAR_OBRA: TypedDocumentNode<{ criarObra: Obra }, { input: CriarObraInput }> = gql`
  mutation CriarObra($input: CriarObraInput!) {
    criarObra(input: $input) { id nome ativa }
  }
`;

export const ATUALIZAR_OBRA: TypedDocumentNode<
  { atualizarObra: Obra }, { id: string; input: AtualizarObraInput }
> = gql`
  mutation AtualizarObra($id: ID!, $input: AtualizarObraInput!) {
    atualizarObra(id: $id, input: $input) { id nome ativa }
  }
`;

export const ELIMINAR_OBRA: TypedDocumentNode<{ eliminarObra: boolean }, { id: string }> = gql`
  mutation EliminarObra($id: ID!) {
    eliminarObra(id: $id)
  }
`;

export const ATRIBUIR_OBRA: TypedDocumentNode<
  { atribuirObra: { id: string; obra: Obra | null } }, { despesaId: string; obraId: string }
> = gql`
  mutation AtribuirObra($despesaId: ID!, $obraId: ID!) {
    atribuirObra(despesaId: $despesaId, obraId: $obraId) { id obra { id nome ativa } }
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

export interface Fornecedor {
  id: string;
  nif: string;
  nome: string | null;
  morada: string | null;
}

export const FORNECEDORES: TypedDocumentNode<{ fornecedores: Fornecedor[] }> = gql`
  query Fornecedores { fornecedores { id nif nome morada } }
`;

export interface CriarFornecedorInput {
  nif: string;
  nome?: string | null;
  morada?: string | null;
}

export interface AtualizarFornecedorInput {
  nif?: string;
  nome?: string | null;
  morada?: string | null;
}

export const CRIAR_FORNECEDOR: TypedDocumentNode<
  { criarFornecedor: Fornecedor }, { input: CriarFornecedorInput }
> = gql`
  mutation CriarFornecedor($input: CriarFornecedorInput!) {
    criarFornecedor(input: $input) { id nif nome morada }
  }
`;

export const ATUALIZAR_FORNECEDOR: TypedDocumentNode<
  { atualizarFornecedor: Fornecedor }, { id: string; input: AtualizarFornecedorInput }
> = gql`
  mutation AtualizarFornecedor($id: ID!, $input: AtualizarFornecedorInput!) {
    atualizarFornecedor(id: $id, input: $input) { id nif nome morada }
  }
`;

export const ELIMINAR_FORNECEDOR: TypedDocumentNode<
  { eliminarFornecedor: boolean }, { id: string }
> = gql`
  mutation EliminarFornecedor($id: ID!) {
    eliminarFornecedor(id: $id)
  }
`;

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
}

export const UTILIZADORES: TypedDocumentNode<{ utilizadores: Utilizador[] }> = gql`
  query Utilizadores { utilizadores { id nome email } }
`;

export interface CriarUtilizadorInput {
  nome: string;
  email: string;
}

export interface AtualizarUtilizadorInput {
  nome?: string;
  email?: string;
}

export const CRIAR_UTILIZADOR: TypedDocumentNode<
  { criarUtilizador: Utilizador }, { input: CriarUtilizadorInput }
> = gql`
  mutation CriarUtilizador($input: CriarUtilizadorInput!) {
    criarUtilizador(input: $input) { id nome email }
  }
`;

export const ATUALIZAR_UTILIZADOR: TypedDocumentNode<
  { atualizarUtilizador: Utilizador }, { id: string; input: AtualizarUtilizadorInput }
> = gql`
  mutation AtualizarUtilizador($id: ID!, $input: AtualizarUtilizadorInput!) {
    atualizarUtilizador(id: $id, input: $input) { id nome email }
  }
`;

export const ELIMINAR_UTILIZADOR: TypedDocumentNode<
  { eliminarUtilizador: boolean }, { id: string }
> = gql`
  mutation EliminarUtilizador($id: ID!) {
    eliminarUtilizador(id: $id)
  }
`;
