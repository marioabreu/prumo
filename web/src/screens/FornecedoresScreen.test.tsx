import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { FornecedoresScreen } from "./FornecedoresScreen.js";
import { FORNECEDORES, CRIAR_FORNECEDOR, ATUALIZAR_FORNECEDOR, ELIMINAR_FORNECEDOR } from "../graphql.js";

const fornecedorA = { id: "f1", nif: "502544180", nome: "Leroy Merlin", morada: null };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <FornecedoresScreen />
    </MockedProvider>
  );
}

describe("FornecedoresScreen", () => {
  it("lista os fornecedores existentes", async () => {
    renderScreen([{ request: { query: FORNECEDORES }, result: { data: { fornecedores: [fornecedorA] } } }]);
    expect(await screen.findByText("Leroy Merlin")).toBeInTheDocument();
    expect(screen.getByText("502544180")).toBeInTheDocument();
  });

  it("avisa (sem bloquear) quando o NIF introduzido falha o checksum", async () => {
    const user = userEvent.setup();
    renderScreen([{ request: { query: FORNECEDORES }, result: { data: { fornecedores: [] } } }]);
    await screen.findByText(/nenhum fornecedor/i);
    await user.type(screen.getByLabelText(/nif/i), "502544181");
    expect(await screen.findByText(/nif pode estar incorreto/i)).toBeInTheDocument();
  });

  it("cria um fornecedor com NIF válido", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: FORNECEDORES }, result: { data: { fornecedores: [] } } },
      {
        request: { query: CRIAR_FORNECEDOR, variables: { input: { nif: "502544180", nome: "", morada: "" } } },
        result: { data: { criarFornecedor: { id: "f2", nif: "502544180", nome: null, morada: null } } },
      },
      { request: { query: FORNECEDORES }, result: { data: { fornecedores: [fornecedorA] } } },
    ];
    renderScreen(mocks);

    await screen.findByText(/nenhum fornecedor/i);
    await user.type(screen.getByLabelText(/nif/i), "502544180");
    await user.click(screen.getByRole("button", { name: /criar/i }));

    expect(await screen.findByText("Leroy Merlin")).toBeInTheDocument();
  });

  it("elimina em dois passos e mostra o erro do guard quando rejeitado", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: FORNECEDORES }, result: { data: { fornecedores: [fornecedorA] } } },
      {
        request: { query: ELIMINAR_FORNECEDOR, variables: { id: "f1" } },
        error: new Error("Não é possível eliminar: existem despesas associadas a este fornecedor."),
      },
    ];
    renderScreen(mocks);

    await screen.findByText("Leroy Merlin");
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(await screen.findByText(/despesas associadas/)).toBeInTheDocument();
  });

  it("permite editar o nome/morada de um fornecedor sem nome", async () => {
    const user = userEvent.setup();
    const semNome = { id: "f3", nif: "999999990", nome: null, morada: null };
    const mocks = [
      { request: { query: FORNECEDORES }, result: { data: { fornecedores: [semNome] } } },
      {
        request: { query: ATUALIZAR_FORNECEDOR, variables: { id: "f3", input: { nome: "Empresa Manual", morada: "Porto" } } },
        result: { data: { atualizarFornecedor: { id: "f3", nif: "999999990", nome: "Empresa Manual", morada: "Porto" } } },
      },
      { request: { query: FORNECEDORES }, result: { data: { fornecedores: [{ ...semNome, nome: "Empresa Manual", morada: "Porto" }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("999999990");
    await user.click(screen.getByRole("button", { name: /editar/i }));
    const camposNome = screen.getAllByLabelText(/^nome$/i);
    const camposMorada = screen.getAllByLabelText(/^morada$/i);
    await user.type(camposNome[camposNome.length - 1], "Empresa Manual");
    await user.type(camposMorada[camposMorada.length - 1], "Porto");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText("Empresa Manual")).toBeInTheDocument();
  });
});
