import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { UtilizadoresScreen } from "./UtilizadoresScreen.js";
import { UTILIZADORES, CRIAR_UTILIZADOR, ELIMINAR_UTILIZADOR } from "../graphql.js";

const utilizadorA = { id: "u1", nome: "Ana", email: "ana@exemplo.pt" };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <UtilizadoresScreen />
    </MockedProvider>
  );
}

describe("UtilizadoresScreen", () => {
  it("lista os utilizadores existentes", async () => {
    renderScreen([{ request: { query: UTILIZADORES }, result: { data: { utilizadores: [utilizadorA] } } }]);
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("ana@exemplo.pt")).toBeInTheDocument();
  });

  it("avisa (sem bloquear o formulário) quando o email não parece válido", async () => {
    const user = userEvent.setup();
    renderScreen([{ request: { query: UTILIZADORES }, result: { data: { utilizadores: [] } } }]);
    await screen.findByText(/nenhum utilizador/i);
    await user.type(screen.getByLabelText(/email/i), "não-é-email");
    expect(await screen.findByText(/email pode estar incorreto/i)).toBeInTheDocument();
  });

  it("cria um utilizador", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: UTILIZADORES }, result: { data: { utilizadores: [] } } },
      {
        request: { query: CRIAR_UTILIZADOR, variables: { input: { nome: "Ana", email: "ana@exemplo.pt" } } },
        result: { data: { criarUtilizador: utilizadorA } },
      },
      { request: { query: UTILIZADORES }, result: { data: { utilizadores: [utilizadorA] } } },
    ];
    renderScreen(mocks);

    await screen.findByText(/nenhum utilizador/i);
    await user.type(screen.getByLabelText(/nome/i), "Ana");
    await user.type(screen.getByLabelText(/email/i), "ana@exemplo.pt");
    await user.click(screen.getByRole("button", { name: /criar/i }));

    expect(await screen.findByText("Ana")).toBeInTheDocument();
  });

  it("elimina em dois passos, sem guard do servidor", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: UTILIZADORES }, result: { data: { utilizadores: [utilizadorA] } } },
      { request: { query: ELIMINAR_UTILIZADOR, variables: { id: "u1" } }, result: { data: { eliminarUtilizador: true } } },
      { request: { query: UTILIZADORES }, result: { data: { utilizadores: [] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Ana");
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(screen.queryByText("Ana")).not.toBeInTheDocument());
  });
});
