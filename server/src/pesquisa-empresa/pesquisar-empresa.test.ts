import { describe, it, expect, vi } from "vitest";
import { criarPesquisarEmpresa } from "./pesquisar-empresa.js";

function respostaJson(corpo: unknown, ok = true): Response {
  return { ok, json: async () => corpo } as Response;
}

describe("criarPesquisarEmpresa", () => {
  it("usa o nome e morada do VIES quando disponíveis", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      respostaJson({ isValid: true, name: "VODAFONE PORTUGAL S A", address: "AVENIDA X\nLISBOA" })
    );
    const pesquisar = criarPesquisarEmpresa(fetchFn as unknown as typeof fetch);

    const resultado = await pesquisar("502544180");

    expect(resultado).toEqual({ nome: "VODAFONE PORTUGAL S A", morada: "AVENIDA X LISBOA" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toContain("vies");
  });

  it("recorre ao nif.pt quando o VIES não tem o nome (---)", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaJson({ isValid: true, name: "---", address: "---" }))
      .mockResolvedValueOnce(
        respostaJson({ result: "success", records: { "502544180": { title: "Empresa Exemplo Lda", city: "Porto" } } })
      );
    const pesquisar = criarPesquisarEmpresa(fetchFn as unknown as typeof fetch);

    const resultado = await pesquisar("502544180");

    expect(resultado).toEqual({ nome: "Empresa Exemplo Lda", morada: "Porto" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("rejeita o placeholder do nif.pt quando é preciso chave de API", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaJson({ isValid: false }))
      .mockResolvedValueOnce(
        respostaJson({
          result: "success",
          message: "Key necessary. Contact www.nif.pt/contactos/api/",
          records: { "502544180": { title: "Key necessary. Contact www.nif.pt/contactos/api/", city: "" } },
        })
      );
    const pesquisar = criarPesquisarEmpresa(fetchFn as unknown as typeof fetch);

    const resultado = await pesquisar("502544180");

    expect(resultado).toEqual({ nome: null, morada: null });
  });

  it("devolve sem dados quando ambos os serviços falham, sem lançar", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("timeout"));
    const pesquisar = criarPesquisarEmpresa(fetchFn as unknown as typeof fetch);

    const resultado = await pesquisar("502544180");

    expect(resultado).toEqual({ nome: null, morada: null });
  });

  it("devolve sem dados quando o VIES responde que o NIF não é válido", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaJson({ isValid: false }))
      .mockResolvedValueOnce(respostaJson({ result: "success", records: {} }));
    const pesquisar = criarPesquisarEmpresa(fetchFn as unknown as typeof fetch);

    const resultado = await pesquisar("999999990");

    expect(resultado).toEqual({ nome: null, morada: null });
  });
});
