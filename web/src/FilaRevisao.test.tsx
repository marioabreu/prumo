import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { FilaRevisao } from "./FilaRevisao.js";
import {
  FILA_REVISAO, SUGESTAO_CENTRO_CUSTO, CENTROS_CUSTO, TOTAIS_POR_CENTRO_CUSTO,
  ATRIBUIR_CENTRO_CUSTO, CONFIRMAR, ATUALIZAR_VALORES,
} from "./graphql.js";

const despesaMock = {
  __typename: "Despesa", id: "d1", nifFornecedor: "502544180",
  fornecedor: { __typename: "Fornecedor", nome: "Fornecedor X" },
  numeroFatura: "FT 1", dataFatura: "2026-08-01",
  baseTributavel: "21.09", valorIva: "4.86", valorTotal: "25.95",
  qrRaw: "A:502544180", estado: "POR_REVER",
};

const centrosCustoMock = [
  { __typename: "CentroCusto", id: "o1", nome: "Obra Norte", ativa: true },
  { __typename: "CentroCusto", id: "o2", nome: "Obra Sul", ativa: true },
];

function baseMocks() {
  return [
    { request: { query: FILA_REVISAO }, result: { data: { filaRevisao: [despesaMock] } } },
    { request: { query: CENTROS_CUSTO }, result: { data: { centrosCusto: centrosCustoMock } } },
    {
      request: { query: SUGESTAO_CENTRO_CUSTO, variables: { despesaId: "d1" } },
      result: { data: { sugestaoCentroCusto: { centroCustoId: "o1", motivo: "3 das últimas 4 faturas deste fornecedor", score: 0.8 } } },
    },
    { request: { query: TOTAIS_POR_CENTRO_CUSTO }, result: { data: { totaisPorCentroCusto: [] } } },
  ];
}

function renderFila(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <FilaRevisao />
    </MockedProvider>
  );
}

describe("FilaRevisao", () => {
  it("mostra a despesa (lista + detalhe) e a sugestão pré-preenchida com o motivo visível", async () => {
    renderFila(baseMocks());
    expect((await screen.findAllByText("Fornecedor X")).length).toBeGreaterThan(0);
    expect(await screen.findByText(/3 das últimas 4 faturas deste fornecedor/)).toBeInTheDocument();
  });

  it("confirmar com o centro de custo sugerido remove o cartão da fila (tecla Enter)", async () => {
    const user = userEvent.setup();
    const mocks = [
      ...baseMocks(),
      {
        request: { query: ATRIBUIR_CENTRO_CUSTO, variables: { despesaId: "d1", centroCustoId: "o1" } },
        result: { data: { atribuirCentroCusto: { __typename: "Despesa", id: "d1", centroCusto: { __typename: "CentroCusto", id: "o1", nome: "Obra Norte", ativa: true } } } },
      },
      {
        request: { query: CONFIRMAR, variables: { despesaId: "d1" } },
        result: { data: { confirmar: { __typename: "Despesa", id: "d1", estado: "CONFIRMADA" } } },
      },
      // segunda leitura da fila, disparada pelo refetch() a seguir a confirmar — já sem a despesa
      { request: { query: FILA_REVISAO }, result: { data: { filaRevisao: [] } } },
    ];
    renderFila(mocks);

    await screen.findAllByText("Fornecedor X");
    await screen.findByText(/3 das últimas 4 faturas deste fornecedor/);
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.queryAllByText("Fornecedor X")).toHaveLength(0);
    });
  });

  it("a tecla 2 seleciona o segundo centro de custo da grelha de atalhos", async () => {
    const user = userEvent.setup();
    renderFila(baseMocks());

    await screen.findAllByText("Fornecedor X");
    await screen.findByText(/3 das últimas 4 faturas deste fornecedor/);
    await user.keyboard("2");

    expect(screen.getByRole("button", { name: /2.*Obra Sul/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("a tecla E abre a edição de valores e guarda com atualizarValores", async () => {
    const user = userEvent.setup();
    const mocks = [
      ...baseMocks(),
      {
        request: {
          query: ATUALIZAR_VALORES,
          variables: { despesaId: "d1", input: { baseTributavel: "30.00", valorIva: "4.86", valorTotal: "25.95" } },
        },
        result: { data: { atualizarValores: { __typename: "Despesa", id: "d1", baseTributavel: "30.00", valorIva: "4.86", valorTotal: "25.95" } } },
      },
    ];
    renderFila(mocks);

    await screen.findAllByText("Fornecedor X");
    await user.keyboard("e");

    const baseInput = await screen.findByLabelText(/base tributável/i);
    await user.clear(baseInput);
    await user.type(baseInput, "30.00");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.queryByLabelText(/base tributável/i)).not.toBeInTheDocument());
  });
});
