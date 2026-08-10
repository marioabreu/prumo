/**
 * Registo de feature flags. Uma feature em desenvolvimento entra aqui com
 * ativa:false por defeito (semeada no arranque via `semearFuncionalidades`);
 * o ecrã Definições liga/desliga cada uma sem precisar de deploy. Remover a
 * entrada não apaga a linha na BD, só deixa de a semear/reafirmar o nome.
 */
export interface RegistoFuncionalidade {
  chave: string;
  nome: string;
}

export const REGISTO_FUNCIONALIDADES: RegistoFuncionalidade[] = [];

export async function semearFuncionalidades(
  repos: { funcionalidades: { definir(chave: string, nome: string): Promise<unknown> } },
  registo: RegistoFuncionalidade[] = REGISTO_FUNCIONALIDADES
): Promise<void> {
  for (const { chave, nome } of registo) {
    await repos.funcionalidades.definir(chave, nome);
  }
}
