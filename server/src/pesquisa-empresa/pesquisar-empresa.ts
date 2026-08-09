export interface DadosEmpresa {
  nome: string | null;
  morada: string | null;
}

export type PesquisarEmpresa = (nif: string) => Promise<DadosEmpresa>;

const SEM_DADOS: DadosEmpresa = { nome: null, morada: null };

async function comTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function limparTexto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.replace(/\s+/g, " ").trim();
  return limpo && limpo !== "---" ? limpo : null;
}

/**
 * VIES (serviço oficial da UE, gratuito, sem chave). Para NIFs portugueses a
 * AT por vezes alimenta nome/morada, por vezes não — nesse caso vem "---" e
 * tratamos como sem dados, nunca como erro.
 */
async function pesquisarVies(nif: string, fetchFn: typeof fetch, timeoutMs: number): Promise<DadosEmpresa | null> {
  try {
    const resposta = await comTimeout(
      (signal) => fetchFn(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/PT/vat/${nif}`, { signal }),
      timeoutMs
    );
    if (!resposta.ok) return null;
    const corpo = await resposta.json();
    if (!corpo.isValid) return null;
    const nome = limparTexto(corpo.name);
    if (!nome) return null;
    return { nome, morada: limparTexto(corpo.address) };
  } catch {
    return null;
  }
}

/**
 * nif.pt (serviço não-oficial, sem garantias). Sem chave de API só valida o
 * NIF e devolve um "title" placeholder a pedir a chave — nesse caso o title
 * é literalmente igual à mensagem de erro, por isso rejeitamos esse caso em
 * vez de guardar "Key necessary..." como nome de fornecedor.
 */
async function pesquisarNifPt(nif: string, fetchFn: typeof fetch, timeoutMs: number): Promise<DadosEmpresa | null> {
  try {
    const resposta = await comTimeout(
      (signal) => fetchFn(`https://www.nif.pt/?json=1&q=${nif}`, { signal }),
      timeoutMs
    );
    if (!resposta.ok) return null;
    const corpo = await resposta.json();
    const registo = corpo?.records?.[nif];
    if (!registo) return null;
    const nome = limparTexto(registo.title);
    if (!nome || nome === corpo.message) return null;
    return { nome, morada: limparTexto(registo.city) };
  } catch {
    return null;
  }
}

/** VIES primeiro (oficial, grátis); nif.pt como fallback; nunca lança — falha silenciosa vira SEM_DADOS. */
export function criarPesquisarEmpresa(fetchFn: typeof fetch = fetch, timeoutMs = 4000): PesquisarEmpresa {
  return async (nif) => {
    const viaVies = await pesquisarVies(nif, fetchFn, timeoutMs);
    if (viaVies?.nome) return viaVies;
    const viaNifPt = await pesquisarNifPt(nif, fetchFn, timeoutMs);
    if (viaNifPt?.nome) return viaNifPt;
    return SEM_DADOS;
  };
}
