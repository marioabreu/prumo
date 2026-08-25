import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { useRotulosCentroCusto } from "./useRotulosCentroCusto.js";
import { ROTULOS_CENTRO_CUSTO } from "../graphql.js";

function wrapper(mocks: any[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );
}

describe("useRotulosCentroCusto", () => {
  it("devolve Obra/Obras por defeito antes da query responder", () => {
    const { result } = renderHook(() => useRotulosCentroCusto(), {
      wrapper: wrapper([
        {
          request: { query: ROTULOS_CENTRO_CUSTO },
          result: { data: { rotulosCentroCusto: { singular: "Obra", plural: "Obras" } } },
        },
      ]),
    });
    expect(result.current).toEqual({ singular: "Obra", plural: "Obras" });
  });

  it("devolve o rótulo configurado depois da query responder", async () => {
    const { result } = renderHook(() => useRotulosCentroCusto(), {
      wrapper: wrapper([
        {
          request: { query: ROTULOS_CENTRO_CUSTO },
          result: { data: { rotulosCentroCusto: { singular: "Projeto", plural: "Projetos" } } },
        },
      ]),
    });
    await waitFor(() => expect(result.current).toEqual({ singular: "Projeto", plural: "Projetos" }));
  });
});
