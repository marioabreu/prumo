export type EstadoDespesa = "POR_REVER" | "CONFIRMADA" | "ADIADA";

export interface Obra {
  id: string;
  nome: string;
  ativa: boolean;
}

export interface Fornecedor {
  id: string;
  nif: string;
  nome: string | null;
  morada: string | null;
}

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
}

export interface Tarefa {
  id: string;
  texto: string;
  feita: boolean;
  criadaEm: Date;
}

export interface Funcionalidade {
  id: string;
  chave: string;
  nome: string;
  ativa: boolean;
}

export interface Despesa {
  id: string;
  nifFornecedor: string;
  fornecedorId: string | null;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string; // Decimal como string — nunca number no domínio real
  valorIva: string;
  valorTotal: string;
  ficheiroUrl: string;
  qrRaw: string | null;
  origem: "UPLOAD" | "EMAIL";
  obraId: string | null;
  estado: EstadoDespesa;
  lockPorId: string | null;
  lockExpiraEm: Date | null;
  criadaEm: Date;
}

export interface CriarDespesaInput {
  nifFornecedor: string;
  fornecedorId?: string | null;
  numeroFatura: string;
  dataFatura: string;
  baseTributavel: string;
  valorIva: string;
  valorTotal: string;
  ficheiroUrl: string;
  qrRaw: string | null;
  origem: "UPLOAD" | "EMAIL";
}

export interface AtualizarValoresInput {
  baseTributavel?: string;
  valorIva?: string;
  valorTotal?: string;
}

export interface DespesasFiltro {
  estado?: EstadoDespesa;
  obraId?: string;
}

export interface CriarObraInput {
  nome: string;
  ativa?: boolean;
}

export interface AtualizarObraInput {
  nome?: string;
  ativa?: boolean;
}

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

export interface CriarUtilizadorInput {
  nome: string;
  email: string;
}

export interface AtualizarUtilizadorInput {
  nome?: string;
  email?: string;
}

export interface CriarTarefaInput {
  texto: string;
}

export interface AtualizarTarefaInput {
  texto?: string;
  feita?: boolean;
}

export interface TotalObra {
  obraId: string;
  total: string;
}

export const LOCK_TTL_MS = 5 * 60 * 1000;

// Mensagens partilhadas pelo guard de eliminação — memoria.ts e prisma.ts têm de
// devolver exatamente o mesmo texto para que os testes de resolvers (escritos só
// contra o repo em memória) valham para os dois backends.
export const ERRO_OBRA_EM_USO =
  "Não é possível eliminar: existem despesas associadas a esta obra.";
export const ERRO_FORNECEDOR_EM_USO =
  "Não é possível eliminar: existem despesas associadas a este fornecedor.";

export interface Repos {
  obras: {
    listar(): Promise<Obra[]>;
    ativas(): Promise<Obra[]>;
    obterPorId(id: string): Promise<Obra | null>;
    criar(input: CriarObraInput): Promise<Obra>;
    atualizar(id: string, patch: AtualizarObraInput): Promise<Obra>;
    eliminar(id: string): Promise<void>;
  };
  fornecedores: {
    listar(): Promise<Fornecedor[]>;
    obterPorNif(nif: string): Promise<Fornecedor | null>;
    upsert(nif: string, dados?: { nome?: string | null; morada?: string | null }): Promise<Fornecedor>;
    criar(input: CriarFornecedorInput): Promise<Fornecedor>;
    atualizar(id: string, patch: AtualizarFornecedorInput): Promise<Fornecedor>;
    eliminar(id: string): Promise<void>;
    historico(nif: string, limite: number): Promise<Despesa[]>;
  };
  utilizadores: {
    listar(): Promise<Utilizador[]>;
    obterPorId(id: string): Promise<Utilizador | null>;
    criar(input: CriarUtilizadorInput): Promise<Utilizador>;
    atualizar(id: string, patch: AtualizarUtilizadorInput): Promise<Utilizador>;
    eliminar(id: string): Promise<void>;
  };
  tarefas: {
    listar(): Promise<Tarefa[]>;
    criar(input: CriarTarefaInput): Promise<Tarefa>;
    atualizar(id: string, patch: AtualizarTarefaInput): Promise<Tarefa>;
    eliminar(id: string): Promise<void>;
    eliminarFeitas(): Promise<number>;
  };
  funcionalidades: {
    listar(): Promise<Funcionalidade[]>;
    // Idempotente: cria com ativa:false se a chave ainda não existir; nunca
    // toca em "ativa" numa chave já existente (o registo de código pode
    // mudar o "nome" ao longo do tempo, mas não deve apagar a escolha do utilizador).
    definir(chave: string, nome: string): Promise<Funcionalidade>;
    atualizar(chave: string, ativa: boolean): Promise<Funcionalidade>;
  };
  despesas: {
    obterPorChaveDedup(
      nifFornecedor: string,
      numeroFatura: string,
      dataFatura: string
    ): Promise<Despesa | null>;
    criar(input: CriarDespesaInput): Promise<Despesa>;
    obterPorId(id: string): Promise<Despesa | null>;
    listar(filtro?: DespesasFiltro): Promise<Despesa[]>;
    bloquear(id: string, utilizadorId: string): Promise<Despesa>;
    atribuirObra(id: string, obraId: string): Promise<Despesa>;
    atualizarValores(id: string, patch: AtualizarValoresInput): Promise<Despesa>;
    confirmar(id: string): Promise<Despesa>;
    adiar(id: string): Promise<Despesa>;
    totaisPorObra(): Promise<TotalObra[]>;
  };
}

export function lockAtivoDeOutro(
  despesa: Pick<Despesa, "lockPorId" | "lockExpiraEm">,
  utilizadorId: string,
  agora: Date = new Date()
): boolean {
  if (!despesa.lockPorId || despesa.lockPorId === utilizadorId) return false;
  if (!despesa.lockExpiraEm) return false;
  return despesa.lockExpiraEm.getTime() > agora.getTime();
}
