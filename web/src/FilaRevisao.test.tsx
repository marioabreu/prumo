import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { FilaRevisao } from "./FilaRevisao.js";
import { FILA_REVISAO, SUGESTAO_OBRA, OBRAS, ATRIBUIR_OBRA, CONFIRMAR } from "./graphql.js";

const despesaMock = {
  id: "d1", nifFornecedor: "502544180", fornecedor: { nome: "Fornecedor X" },
  numeroFatura: "FT 1", dataFatura: "2026-08-01", valorTotal: "25.95", estado: "POR_REVER",
};

const mocks = [
  { request: { query: FILA_REVISAO }, result: { data: { filaRevisao: [despesaMock] } } },
  { request: { query: OBRAS }, result: { data: { obras: [{ id: "o1", nome: "Obra Norte" }] } } },
  {
    request: { query: SUGESTAO_OBRA, variables: { despesaId: "d1" } },
    result: { data: { sugestaoObra: { obraId: "o1", motivo: "3 das últimas 4 faturas deste fornecedor", score: 0.8 } } },
  },
  {
    request: { query: ATRIBUIR_OBRA, variables: { despesaId: "d1", obraId: "o1" } },
    result: { data: { atribuirObra: { id: "d1", obra: { id: "o1", nome: "Obra Norte" } } } },
  },
  {
    request: { query: CONFIRMAR, variables: { despesaId: "d1" } },
    result: { data: { confirmar: { id: "d1", estado: "CONFIRMADA" } } },
  },
  // segunda leitura da fila, disparada pelo refetch() a seguir a confirmar — já sem a despesa
  { request: { query: FILA_REVISAO }, result: { data: { filaRevisao: [] } } },
];

describe("FilaRevisao", () => {
  it("mostra a despesa e a sugestão pré-preenchida com o motivo visível", async () => {
    render(
      <MockedProvider mocks={mocks}>
        <FilaRevisao />
      </MockedProvider>
    );
    expect(await screen.findByText("Fornecedor X")).toBeInTheDocument();
    expect(await screen.findByText(/3 das últimas 4 faturas deste fornecedor/)).toBeInTheDocument();
  });

  it("confirmar com a obra sugerida remove o cartão da fila (tecla Enter)", async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider mocks={mocks}>
        <FilaRevisao />
      </MockedProvider>
    );
    await screen.findByText("Fornecedor X");
    // esperar a sugestão pré-preencher a obra — só depois o Enter confirma
    await screen.findByText(/3 das últimas 4 faturas deste fornecedor/);
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.queryByText("Fornecedor X")).not.toBeInTheDocument();
    });
  });
});
