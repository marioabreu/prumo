import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { TarefasScreen } from "./TarefasScreen.js";
import {
  TAREFAS, CRIAR_TAREFA, ATUALIZAR_TAREFA, ELIMINAR_TAREFA, ELIMINAR_TAREFAS_FEITAS,
} from "../graphql.js";

const tarefaA = { id: "t1", texto: "Adicionar export CSV", feita: false, criadaEm: "2026-08-10" };
const tarefaB = { id: "t2", texto: "Ligar subscriptions", feita: true, criadaEm: "2026-08-09" };

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <TarefasScreen />
    </MockedProvider>
  );
}

describe("TarefasScreen", () => {
  it("lista as tarefas existentes, com as feitas riscadas", async () => {
    renderScreen([{ request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA, tarefaB] } } }]);
    expect(await screen.findByText("Adicionar export CSV")).toBeInTheDocument();
    expect(screen.getByText("Ligar subscriptions")).toBeInTheDocument();
  });

  it("cria uma nova tarefa", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: TAREFAS }, result: { data: { tarefas: [] } } },
      {
        request: { query: CRIAR_TAREFA, variables: { input: { texto: "Nova ideia" } } },
        result: { data: { criarTarefa: { id: "t3", texto: "Nova ideia", feita: false, criadaEm: "2026-08-10" } } },
      },
      { request: { query: TAREFAS }, result: { data: { tarefas: [{ id: "t3", texto: "Nova ideia", feita: false, criadaEm: "2026-08-10" }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText(/nenhuma tarefa/i);
    await user.type(screen.getByLabelText(/nova tarefa/i), "Nova ideia");
    await user.click(screen.getByRole("button", { name: /adicionar/i }));

    expect(await screen.findByText("Nova ideia")).toBeInTheDocument();
  });

  it("marca uma tarefa como feita através da checkbox", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA] } } },
      {
        request: { query: ATUALIZAR_TAREFA, variables: { id: "t1", input: { feita: true } } },
        result: { data: { atualizarTarefa: { ...tarefaA, feita: true } } },
      },
      { request: { query: TAREFAS }, result: { data: { tarefas: [{ ...tarefaA, feita: true }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Adicionar export CSV");
    await user.click(screen.getByRole("checkbox"));

    await screen.findByRole("checkbox", { checked: true });
  });

  it("edita o texto de uma tarefa", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA] } } },
      {
        request: { query: ATUALIZAR_TAREFA, variables: { id: "t1", input: { texto: "Texto corrigido" } } },
        result: { data: { atualizarTarefa: { ...tarefaA, texto: "Texto corrigido" } } },
      },
      { request: { query: TAREFAS }, result: { data: { tarefas: [{ ...tarefaA, texto: "Texto corrigido" }] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Adicionar export CSV");
    await user.click(screen.getByRole("button", { name: /editar/i }));
    const campo = screen.getByLabelText(/^texto$/i);
    await user.clear(campo);
    await user.type(campo, "Texto corrigido");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText("Texto corrigido")).toBeInTheDocument();
  });

  it("elimina uma tarefa em dois passos (pede confirmação)", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA] } } },
      { request: { query: ELIMINAR_TAREFA, variables: { id: "t1" } }, result: { data: { eliminarTarefa: true } } },
      { request: { query: TAREFAS }, result: { data: { tarefas: [] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Adicionar export CSV");
    await user.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(screen.getByText("Adicionar export CSV")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    await screen.findByText(/nenhuma tarefa/i);
  });

  it("mostra 'Eliminar concluídas' só quando há tarefas feitas, e pede confirmação", async () => {
    const user = userEvent.setup();
    const mocks = [
      { request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA, tarefaB] } } },
      { request: { query: ELIMINAR_TAREFAS_FEITAS }, result: { data: { eliminarTarefasFeitas: 1 } } },
      { request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA] } } },
    ];
    renderScreen(mocks);

    await screen.findByText("Ligar subscriptions");
    await user.click(screen.getByRole("button", { name: /eliminar concluídas/i }));
    expect(screen.getByText("Ligar subscriptions")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(screen.queryByText("Ligar subscriptions")).not.toBeInTheDocument());
  });

  it("não mostra 'Eliminar concluídas' quando não há tarefas feitas", async () => {
    renderScreen([{ request: { query: TAREFAS }, result: { data: { tarefas: [tarefaA] } } }]);
    await screen.findByText("Adicionar export CSV");
    expect(screen.queryByRole("button", { name: /eliminar concluídas/i })).not.toBeInTheDocument();
  });
});
