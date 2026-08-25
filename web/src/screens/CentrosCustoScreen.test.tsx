import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { CentrosCustoScreen } from "./CentrosCustoScreen.js";
import { CENTROS_CUSTO, CRIAR_CENTRO_CUSTO, ELIMINAR_CENTRO_CUSTO } from "../graphql.js";

const centroA = { id: "o1", nome: "Obra Norte", ativa: true };
const centroB = { id: "o2", nome: "Obra Sul", ativa: false };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <CentrosCustoScreen />
    </MockedProvider>
  );
}

describe("CentrosCustoScreen", () => {
  it("lista os centros de custo existentes", async () => {
    renderScreen([{ request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: [centroA, centroB] } } }]);
    expect(await screen.findByText("Obra Norte")).toBeInTheDocument();
    expect(await screen.findByText("Obra Sul")).toBeInTheDocument();
  });

  it("cria um centro de custo novo a partir do formulário", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: [] } } },
      {
        request: { query: CRIAR_CENTRO_CUSTO, variables: { input: { nome: "Obra Nova", ativa: true } } },
        result: { data: { criarCentroCusto: { id: "o3", nome: "Obra Nova", ativa: true } } },
      },
      { request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: [{ id: "o3", nome: "Obra Nova", ativa: true }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText(/sem obras/i);
    await user.type(screen.getByLabelText(/nome/i), "Obra Nova");
    await user.click(screen.getByRole("button", { name: /criar/i }));

    expect(await screen.findByText("Obra Nova")).toBeInTheDocument();
  });

  it("elimina um centro de custo em dois passos (eliminar -> confirmar)", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: [centroA] } } },
      { request: { query: ELIMINAR_CENTRO_CUSTO, variables: { id: "o1" } }, result: { data: { eliminarCentroCusto: true } } },
      { request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: [] } } },
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
      { request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: [centroA] } } },
      {
        request: { query: ELIMINAR_CENTRO_CUSTO, variables: { id: "o1" } },
        error: new Error("Não é possível eliminar: existem despesas associadas a este centro de custo."),
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
