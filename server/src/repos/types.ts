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

export interface TotalObra {
  obraId: string;
  total: string;
}

export const LOCK_TTL_MS = 5 * 60 * 1000;

export interface Repos {
  obras: {
    listar(): Promise<Obra[]>;
    ativas(): Promise<Obra[]>;
    obterPorId(id: string): Promise<Obra | null>;
  };
  fornecedores: {
    obterPorNif(nif: string): Promise<Fornecedor | null>;
    upsert(nif: string, nome?: string | null): Promise<Fornecedor>;
    historico(nif: string, limite: number): Promise<Despesa[]>;
  };
  despesas: {
    obterPorChaveDedup(
      nifFornecedor: string,
      numeroFatura: string,
      dataFatura: string
    ): Promise<Despesa | null>;
    criar(input: CriarDespesaInput): Promise<Despesa>;
    obterPorId(id: string): Promise<Despesa | null>;
    listarFila(estado?: EstadoDespesa): Promise<Despesa[]>;
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
