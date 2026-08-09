import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { FilaRevisao } from "./FilaRevisao.js";
import {
  FILA_REVISAO, SUGESTAO_OBRA, OBRAS, TOTAIS_POR_OBRA,
  ATRIBUIR_OBRA, CONFIRMAR, ATUALIZAR_VALORES,
} from "./graphql.js";

const despesaMock = {
  __typename: "Despesa", id: "d1", nifFornecedor: "502544180",
  fornecedor: { __typename: "Fornecedor", nome: "Fornecedor X" },
  numeroFatura: "FT 1", dataFatura: "2026-08-01",
  baseTributavel: "21.09", valorIva: "4.86", valorTotal: "25.95",
  qrRaw: "A:502544180", estado: "POR_REVER",
};

const obrasMock = [
  { __typename: "Obra", id: "o1", nome: "Obra Norte", ativa: true },
  { __typename: "Obra", id: "o2", nome: "Obra Sul", ativa: true },
];

function baseMocks() {
  return [
    { request: { query: FILA_REVISAO }, result: { data: { filaRevisao: [despesaMock] } } },
    { request: { query: OBRAS }, result: { data: { obras: obrasMock } } },
    {
      request: { query: SUGESTAO_OBRA, variables: { despesaId: "d1" } },
      result: { data: { sugestaoObra: { obraId: "o1", motivo: "3 das últimas 4 faturas deste fornecedor", score: 0.8 } } },
    },
    { request: { query: TOTAIS_POR_OBRA }, result: { data: { totaisPorObra: [] } } },
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

  it("confirmar com a obra sugerida remove o cartão da fila (tecla Enter)", async () => {
    const user = userEvent.setup();
    const mocks = [
      ...baseMocks(),
      {
        request: { query: ATRIBUIR_OBRA, variables: { despesaId: "d1", obraId: "o1" } },
        result: { data: { atribuirObra: { __typename: "Despesa", id: "d1", obra: { __typename: "Obra", id: "o1", nome: "Obra Norte", ativa: true } } } },
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

  it("a tecla 2 seleciona a segunda obra da grelha de atalhos", async () => {
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
