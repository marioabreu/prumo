import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { DefinicoesScreen } from "./DefinicoesScreen.js";
import { FUNCIONALIDADES, ATUALIZAR_FUNCIONALIDADE } from "../graphql.js";

const flagA = { id: "f1", chave: "beta-x", nome: "Beta X", ativa: false };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <DefinicoesScreen />
    </MockedProvider>
  );
}

describe("DefinicoesScreen", () => {
  it("mostra mensagem vazia quando não há funcionalidades registadas", async () => {
    renderScreen([{ request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [] } } }]);
    expect(await screen.findByText(/nenhuma funcionalidade/i)).toBeInTheDocument();
  });

  it("lista as funcionalidades e permite ligar uma", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [flagA] } } },
      {
        request: { query: ATUALIZAR_FUNCIONALIDADE, variables: { chave: "beta-x", ativa: true } },
        result: { data: { atualizarFuncionalidade: { ...flagA, ativa: true } } },
      },
      { request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [{ ...flagA, ativa: true }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Beta X");
    const toggle = screen.getByRole("checkbox");
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
  });
});
