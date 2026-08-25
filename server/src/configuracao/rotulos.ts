/**
 * Rótulos de UI configuráveis para o CentroCusto: por defeito a app continua
 * a mostrar "Obra"/"Obras" (o vocabulário original do cliente), mas o ecrã
 * Definições permite trocar por outro par singular/plural sem deploy.
 */
export const CHAVE_LABEL_SINGULAR = "centroCustoLabelSingular";
export const CHAVE_LABEL_PLURAL = "centroCustoLabelPlural";
export const LABEL_SINGULAR_DEFEITO = "Obra";
export const LABEL_PLURAL_DEFEITO = "Obras";

export async function semearRotulosCentroCusto(repos: {
  configuracao: { garantirExiste(chave: string, valorDefeito: string): Promise<unknown> };
}): Promise<void> {
  await repos.configuracao.garantirExiste(CHAVE_LABEL_SINGULAR, LABEL_SINGULAR_DEFEITO);
  await repos.configuracao.garantirExiste(CHAVE_LABEL_PLURAL, LABEL_PLURAL_DEFEITO);
}

export async function obterRotulosCentroCusto(repos: {
  configuracao: { obter(chave: string): Promise<string | null> };
}): Promise<{ singular: string; plural: string }> {
  const [singular, plural] = await Promise.all([
    repos.configuracao.obter(CHAVE_LABEL_SINGULAR),
    repos.configuracao.obter(CHAVE_LABEL_PLURAL),
  ]);
  return {
    singular: singular ?? LABEL_SINGULAR_DEFEITO,
    plural: plural ?? LABEL_PLURAL_DEFEITO,
  };
}
