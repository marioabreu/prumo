import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { DespesasScreen } from "./DespesasScreen.js";
import { DESPESAS, DESPESA, ATUALIZAR_VALORES, ATRIBUIR_CENTRO_CUSTO, CENTROS_CUSTO } from "../graphql.js";

const despesaResumo = {
  __typename: "Despesa", id: "d1", nifFornecedor: "502544180",
  fornecedor: { __typename: "Fornecedor", nome: "Leroy Merlin" },
  numeroFatura: "FT 1", dataFatura: "2026-08-01", valorTotal: "25.95", estado: "POR_REVER",
};

const despesaDetalhe = {
  __typename: "Despesa", id: "d1", nifFornecedor: "502544180",
  fornecedor: { __typename: "Fornecedor", nome: "Leroy Merlin" },
  numeroFatura: "FT 1", dataFatura: "2026-08-01", baseTributavel: "21.09", valorIva: "4.86",
  valorTotal: "25.95", ficheiroUrl: "https://exemplo/f.pdf", qrRaw: "A:x", origem: "UPLOAD",
  centroCusto: null, estado: "POR_REVER",
};

function baseMocks() {
  return [
    { request: { query: DESPESAS, variables: { estado: undefined, centroCustoId: undefined } }, result: { data: { despesas: [despesaResumo] } } },
    { request: { query: DESPESA, variables: { id: "d1" } }, result: { data: { despesa: despesaDetalhe } } },
    {
      request: { query: CENTROS_CUSTO },
      result: { data: { centrosCusto: [{ __typename: "CentroCusto", id: "o1", nome: "Obra Norte", ativa: true }] } },
    },
  ];
}

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <DespesasScreen />
    </MockedProvider>
  );
}

describe("DespesasScreen", () => {
  it("lista as despesas e mostra o detalhe ao selecionar uma", async () => {
    renderScreen(baseMocks());
    await screen.findByText("Leroy Merlin");
    await userEvent.setup().click(screen.getByText("Leroy Merlin"));

    expect(await screen.findByText("FT 1")).toBeInTheDocument();
    expect(screen.getByText("502544180")).toBeInTheDocument();
  });

  it("guarda os valores editados via atualizarValores", async () => {
    const user = userEvent.setup();
    const mocks = [
      ...baseMocks(),
      {
        request: {
          query: ATUALIZAR_VALORES,
          variables: { despesaId: "d1", input: { baseTributavel: "30.00", valorIva: "4.86", valorTotal: "25.95" } },
        },
        result: {
          data: { atualizarValores: { __typename: "Despesa", id: "d1", baseTributavel: "30.00", valorIva: "4.86", valorTotal: "25.95" } },
        },
      },
    ];
    renderScreen(mocks);

    await screen.findByText("Leroy Merlin");
    await user.click(screen.getByText("Leroy Merlin"));
    await screen.findByText("FT 1");

    const baseInput = screen.getByLabelText(/base tributável/i);
    await user.clear(baseInput);
    await user.type(baseInput, "30.00");
    await user.click(screen.getByRole("button", { name: /guardar valores/i }));

    expect(await screen.findByText(/valores guardados/i)).toBeInTheDocument();
  });

  it("reatribui o centro de custo via o grid de atalhos", async () => {
    const user = userEvent.setup();
    const mocks = [
      ...baseMocks(),
      {
        request: { query: ATRIBUIR_CENTRO_CUSTO, variables: { despesaId: "d1", centroCustoId: "o1" } },
        result: {
          data: {
            atribuirCentroCusto: {
              __typename: "Despesa", id: "d1",
              centroCusto: { __typename: "CentroCusto", id: "o1", nome: "Obra Norte", ativa: true },
            },
          },
        },
      },
    ];
    renderScreen(mocks);

    await screen.findByText("Leroy Merlin");
    await user.click(screen.getByText("Leroy Merlin"));
    await screen.findByText("FT 1");
    await user.click(screen.getByRole("button", { name: /obra norte/i }));

    expect(await screen.findByText(/obra atualizada/i)).toBeInTheDocument();
  });
});
