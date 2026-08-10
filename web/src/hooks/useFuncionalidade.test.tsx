import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { useFuncionalidade } from "./useFuncionalidade.js";
import { FUNCIONALIDADES } from "../graphql.js";

function wrapper(mocks: any[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );
}

describe("useFuncionalidade", () => {
  it("devolve false enquanto a query não respondeu", () => {
    const { result } = renderHook(() => useFuncionalidade("beta-x"), {
      wrapper: wrapper([{ request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [] } } }]),
    });
    expect(result.current).toBe(false);
  });

  it("devolve true quando a feature está ativa", async () => {
    const mocks = [{
      request: { query: FUNCIONALIDADES },
      result: { data: { funcionalidades: [{ id: "f1", chave: "beta-x", nome: "Beta X", ativa: true }] } },
    }];
    const { result } = renderHook(() => useFuncionalidade("beta-x"), { wrapper: wrapper(mocks) });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("devolve false quando a chave não existe no registo", async () => {
    const mocks = [{
      request: { query: FUNCIONALIDADES },
      result: { data: { funcionalidades: [{ id: "f1", chave: "outra", nome: "Outra", ativa: true }] } },
    }];
    const { result } = renderHook(() => useFuncionalidade("beta-x"), { wrapper: wrapper(mocks) });
    await waitFor(() => expect(result.current).toBe(false));
  });
});
