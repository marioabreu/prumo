import { describe, it, expect, vi } from "vitest";
import {
  semearRotulosCentroCusto, obterRotulosCentroCusto,
  CHAVE_LABEL_SINGULAR, CHAVE_LABEL_PLURAL, LABEL_SINGULAR_DEFEITO, LABEL_PLURAL_DEFEITO,
} from "./rotulos.js";

describe("semearRotulosCentroCusto", () => {
  it("garante a existência das chaves singular e plural com os valores por defeito", async () => {
    const garantirExiste = vi.fn().mockResolvedValue(undefined);
    await semearRotulosCentroCusto({ configuracao: { garantirExiste } });
    expect(garantirExiste).toHaveBeenCalledWith(CHAVE_LABEL_SINGULAR, LABEL_SINGULAR_DEFEITO);
    expect(garantirExiste).toHaveBeenCalledWith(CHAVE_LABEL_PLURAL, LABEL_PLURAL_DEFEITO);
  });
});

describe("obterRotulosCentroCusto", () => {
  it("devolve singular/plural guardados", async () => {
    const obter = vi.fn(async (chave: string) =>
      chave === CHAVE_LABEL_SINGULAR ? "Projeto" : "Projetos"
    );
    const rotulos = await obterRotulosCentroCusto({ configuracao: { obter } });
    expect(rotulos).toEqual({ singular: "Projeto", plural: "Projetos" });
  });

  it("cai para os valores por defeito quando a chave ainda não existe", async () => {
    const obter = vi.fn(async () => null);
    const rotulos = await obterRotulosCentroCusto({ configuracao: { obter } });
    expect(rotulos).toEqual({ singular: LABEL_SINGULAR_DEFEITO, plural: LABEL_PLURAL_DEFEITO });
  });
});
