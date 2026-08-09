import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { ObrasScreen } from "./ObrasScreen.js";
import { OBRAS, CRIAR_OBRA, ELIMINAR_OBRA } from "../graphql.js";

const obraA = { id: "o1", nome: "Obra Norte", ativa: true };
const obraB = { id: "o2", nome: "Obra Sul", ativa: false };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <ObrasScreen />
    </MockedProvider>
  );
}

describe("ObrasScreen", () => {
  it("lista as obras existentes", async () => {
    renderScreen([{ request: { query: OBRAS }, result: { data: { obras: [obraA, obraB] } } }]);
    expect(await screen.findByText("Obra Norte")).toBeInTheDocument();
    expect(await screen.findByText("Obra Sul")).toBeInTheDocument();
  });

  it("cria uma obra nova a partir do formulário", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: OBRAS }, result: { data: { obras: [] } } },
      {
        request: { query: CRIAR_OBRA, variables: { input: { nome: "Obra Nova", ativa: true } } },
        result: { data: { criarObra: { id: "o3", nome: "Obra Nova", ativa: true } } },
      },
      { request: { query: OBRAS }, result: { data: { obras: [{ id: "o3", nome: "Obra Nova", ativa: true }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText(/nenhuma obra/i);
    await user.type(screen.getByLabelText(/nome/i), "Obra Nova");
    await user.click(screen.getByRole("button", { name: /criar/i }));

    expect(await screen.findByText("Obra Nova")).toBeInTheDocument();
  });

  it("elimina uma obra em dois passos (eliminar -> confirmar)", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: OBRAS }, result: { data: { obras: [obraA] } } },
      { request: { query: ELIMINAR_OBRA, variables: { id: "o1" } }, result: { data: { eliminarObra: true } } },
      { request: { query: OBRAS }, result: { data: { obras: [] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Obra Norte");
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(screen.queryByText("Obra Norte")).not.toBeInTheDocument());
  });

  it("mostra o erro do guard inline quando a eliminação é rejeitada", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: OBRAS }, result: { data: { obras: [obraA] } } },
      {
        request: { query: ELIMINAR_OBRA, variables: { id: "o1" } },
        error: new Error("Não é possível eliminar: existem despesas associadas a esta obra."),
      },
    ];
    renderScreen(mocks);

    await screen.findByText("Obra Norte");
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText(/despesas associadas/)).toBeInTheDocument();
    expect(screen.getByText("Obra Norte")).toBeInTheDocument();
  });
});
