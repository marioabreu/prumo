import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { DefinicoesScreen } from "./DefinicoesScreen.js";
import {
  FUNCIONALIDADES, ATUALIZAR_FUNCIONALIDADE, ROTULOS_CENTRO_CUSTO, ATUALIZAR_ROTULOS_CENTRO_CUSTO,
} from "../graphql.js";

const flagA = { id: "f1", chave: "beta-x", nome: "Beta X", ativa: false };

const rotulosMock = { request: { query: ROTULOS_CENTRO_CUSTO }, result: { data: { rotulosCentroCusto: { singular: "Obra", plural: "Obras" } } } };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <DefinicoesScreen />
    </MockedProvider>
  );
}

describe("DefinicoesScreen", () => {
  it("mostra mensagem vazia quando não há funcionalidades registadas", async () => {
    renderScreen([
      { request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [] } } },
      rotulosMock,
    ]);
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
      rotulosMock,
    ];
    renderScreen(mocks);

    await screen.findByText("Beta X");
    const toggle = screen.getByRole("checkbox");
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
  });
});

describe("DefinicoesScreen — rótulo do centro de custo", () => {
  it("mostra o singular/plural atuais nos campos", async () => {
    renderScreen([
      { request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [] } } },
      rotulosMock,
    ]);

    await waitFor(() => expect(screen.getByLabelText(/singular/i)).toHaveValue("Obra"));
    expect(screen.getByLabelText(/plural/i)).toHaveValue("Obras");
  });

  it("guarda o novo singular/plural via atualizarRotulosCentroCusto", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: FUNCIONALIDADES }, result: { data: { funcionalidades: [] } } },
      rotulosMock,
      {
        request: { query: ATUALIZAR_ROTULOS_CENTRO_CUSTO, variables: { singular: "Projeto", plural: "Projetos" } },
        result: { data: { atualizarRotulosCentroCusto: { singular: "Projeto", plural: "Projetos" } } },
      },
    ];
    renderScreen(mocks);

    await waitFor(() => expect(screen.getByLabelText(/singular/i)).toHaveValue("Obra"));
    const singularInput = screen.getByLabelText(/singular/i);
    await user.clear(singularInput);
    await user.type(singularInput, "Projeto");
    const pluralInput = screen.getByLabelText(/plural/i);
    await user.clear(pluralInput);
    await user.type(pluralInput, "Projetos");

    await user.click(screen.getByRole("button", { name: /guardar rótulo/i }));

    expect(await screen.findByText(/rótulo guardado/i)).toBeInTheDocument();
  });
});
