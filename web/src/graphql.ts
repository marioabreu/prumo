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

export const INGERIR_FATURA: TypedDocumentNode<
  { ingerirFatura: { duplicada: boolean; despesa: { id: string; numeroFatura: string; valorTotal: string } } },
  { ficheiroUrl: string; qrRaw: string }
> = gql`
  mutation IngerirFatura($ficheiroUrl: String!, $qrRaw: String) {
    ingerirFatura(ficheiroUrl: $ficheiroUrl, qrRaw: $qrRaw) {
      duplicada
      despesa { id numeroFatura valorTotal }
    }
  }
`;

export interface TotalCentroCusto {
  centroCusto: { id: string; nome: string };
  total: string;
}

export const TOTAIS_POR_CENTRO_CUSTO: TypedDocumentNode<{ totaisPorCentroCusto: TotalCentroCusto[] }> = gql`
  query TotaisPorCentroCusto {
    totaisPorCentroCusto {
      centroCusto { id nome }
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
  centroCusto: { id: string; nome: string } | null;
}

export const DESPESAS: TypedDocumentNode<
  { despesas: Despesa[] }, { estado?: EstadoDespesa; centroCustoId?: string }
> = gql`
  query Despesas($estado: EstadoDespesa, $centroCustoId: ID) {
    despesas(estado: $estado, centroCustoId: $centroCustoId) {
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
      centroCusto { id nome }
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

export interface SugestaoCentroCusto {
  centroCustoId: string;
  motivo: string;
  score: number;
}

export const SUGESTAO_CENTRO_CUSTO: TypedDocumentNode<
  { sugestaoCentroCusto: SugestaoCentroCusto | null }, { despesaId: string }
> = gql`
  query SugestaoCentroCusto($despesaId: ID!) {
    sugestaoCentroCusto(despesaId: $despesaId) { centroCustoId motivo score }
  }
`;

export interface CentroCusto {
  id: string;
  nome: string;
  ativa: boolean;
}

export const CENTROS_CUSTO: TypedDocumentNode<{ centrosCusto: CentroCusto[] }> = gql`
  query CentrosCusto { centrosCusto { id nome ativa } }
`;

export interface CriarCentroCustoInput {
  nome: string;
  ativa?: boolean;
}

export interface AtualizarCentroCustoInput {
  nome?: string;
  ativa?: boolean;
}

export const CRIAR_CENTRO_CUSTO: TypedDocumentNode<
  { criarCentroCusto: CentroCusto }, { input: CriarCentroCustoInput }
> = gql`
  mutation CriarCentroCusto($input: CriarCentroCustoInput!) {
    criarCentroCusto(input: $input) { id nome ativa }
  }
`;

export const ATUALIZAR_CENTRO_CUSTO: TypedDocumentNode<
  { atualizarCentroCusto: CentroCusto }, { id: string; input: AtualizarCentroCustoInput }
> = gql`
  mutation AtualizarCentroCusto($id: ID!, $input: AtualizarCentroCustoInput!) {
    atualizarCentroCusto(id: $id, input: $input) { id nome ativa }
  }
`;

export const ELIMINAR_CENTRO_CUSTO: TypedDocumentNode<{ eliminarCentroCusto: boolean }, { id: string }> = gql`
  mutation EliminarCentroCusto($id: ID!) {
    eliminarCentroCusto(id: $id)
  }
`;

export const ATRIBUIR_CENTRO_CUSTO: TypedDocumentNode<
  { atribuirCentroCusto: { id: string; centroCusto: CentroCusto | null } },
  { despesaId: string; centroCustoId: string }
> = gql`
  mutation AtribuirCentroCusto($despesaId: ID!, $centroCustoId: ID!) {
    atribuirCentroCusto(despesaId: $despesaId, centroCustoId: $centroCustoId) {
      id
      centroCusto { id nome ativa }
    }
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

export interface Tarefa {
  id: string;
  texto: string;
  feita: boolean;
  criadaEm: string;
}

export const TAREFAS: TypedDocumentNode<{ tarefas: Tarefa[] }> = gql`
  query Tarefas { tarefas { id texto feita criadaEm } }
`;

export interface CriarTarefaInput {
  texto: string;
}

export interface AtualizarTarefaInput {
  texto?: string;
  feita?: boolean;
}

export const CRIAR_TAREFA: TypedDocumentNode<
  { criarTarefa: Tarefa }, { input: CriarTarefaInput }
> = gql`
  mutation CriarTarefa($input: CriarTarefaInput!) {
    criarTarefa(input: $input) { id texto feita criadaEm }
  }
`;

export const ATUALIZAR_TAREFA: TypedDocumentNode<
  { atualizarTarefa: Tarefa }, { id: string; input: AtualizarTarefaInput }
> = gql`
  mutation AtualizarTarefa($id: ID!, $input: AtualizarTarefaInput!) {
    atualizarTarefa(id: $id, input: $input) { id texto feita criadaEm }
  }
`;

export const ELIMINAR_TAREFA: TypedDocumentNode<
  { eliminarTarefa: boolean }, { id: string }
> = gql`
  mutation EliminarTarefa($id: ID!) {
    eliminarTarefa(id: $id)
  }
`;

export const ELIMINAR_TAREFAS_FEITAS: TypedDocumentNode<{ eliminarTarefasFeitas: number }> = gql`
  mutation EliminarTarefasFeitas {
    eliminarTarefasFeitas
  }
`;

export interface Funcionalidade {
  id: string;
  chave: string;
  nome: string;
  ativa: boolean;
}

export const FUNCIONALIDADES: TypedDocumentNode<{ funcionalidades: Funcionalidade[] }> = gql`
  query Funcionalidades { funcionalidades { id chave nome ativa } }
`;

export const ATUALIZAR_FUNCIONALIDADE: TypedDocumentNode<
  { atualizarFuncionalidade: Funcionalidade }, { chave: string; ativa: boolean }
> = gql`
  mutation AtualizarFuncionalidade($chave: String!, $ativa: Boolean!) {
    atualizarFuncionalidade(chave: $chave, ativa: $ativa) { id chave nome ativa }
  }
`;

export interface RotulosCentroCusto {
  singular: string;
  plural: string;
}

export const ROTULOS_CENTRO_CUSTO: TypedDocumentNode<{ rotulosCentroCusto: RotulosCentroCusto }> = gql`
  query RotulosCentroCusto {
    rotulosCentroCusto { singular plural }
  }
`;

export const ATUALIZAR_ROTULOS_CENTRO_CUSTO: TypedDocumentNode<
  { atualizarRotulosCentroCusto: RotulosCentroCusto }, { singular: string; plural: string }
> = gql`
  mutation AtualizarRotulosCentroCusto($singular: String!, $plural: String!) {
    atualizarRotulosCentroCusto(singular: $singular, plural: $plural) { singular plural }
  }
`;
