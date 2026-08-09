import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { NovaDespesaTesteScreen } from "./NovaDespesaTesteScreen.js";
import { INGERIR_FATURA } from "../graphql.js";

function renderScreen(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <NovaDespesaTesteScreen />
    </MockedProvider>
  );
}

async function preencherFormulario(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^nif$/i), "502544180");
  await user.type(screen.getByLabelText(/número da fatura/i), "FT 999/1");
  await user.clear(screen.getByLabelText(/^data$/i));
  await user.type(screen.getByLabelText(/^data$/i), "2026-08-09");
  await user.type(screen.getByLabelText(/base tributável/i), "40.65");
  await user.type(screen.getByLabelText(/^iva$/i), "9.35");
}

describe("NovaDespesaTesteScreen", () => {
  it("avisa quando o NIF introduzido falha o checksum", async () => {
    const user = userEvent.setup();
    renderScreen([]);
    await user.type(screen.getByLabelText(/^nif$/i), "502544181");
    expect(await screen.findByText(/nif pode estar incorreto/i)).toBeInTheDocument();
  });

  it("constrói um QR sintético e cria a despesa via ingerirFatura", async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: INGERIR_FATURA,
          variables: {
            ficheiroUrl: "https://teste/manual",
            qrRaw: "A:502544180*D:FT*F:20260809*G:FT 999/1*I1:PT*I7:40.65*I8:9.35*O:50.00",
          },
        },
        result: { data: { ingerirFatura: { duplicada: false, despesa: { id: "d1", numeroFatura: "FT 999/1", valorTotal: "50.00" } } } },
      },
    ];
    renderScreen(mocks);

    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: /criar despesa/i }));

    expect(await screen.findByText(/despesa criada/i)).toBeInTheDocument();
    // o número da fatura limpa para facilitar criar a próxima
    expect(screen.getByLabelText(/número da fatura/i)).toHaveValue("");
  });

  it("mostra aviso quando a despesa já existe (duplicada)", async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: INGERIR_FATURA,
          variables: {
            ficheiroUrl: "https://teste/manual",
            qrRaw: "A:502544180*D:FT*F:20260809*G:FT 999/1*I1:PT*I7:40.65*I8:9.35*O:50.00",
          },
        },
        result: { data: { ingerirFatura: { duplicada: true, despesa: { id: "d1", numeroFatura: "FT 999/1", valorTotal: "50.00" } } } },
      },
    ];
    renderScreen(mocks);

    await preencherFormulario(user);
    await user.click(screen.getByRole("button", { name: /criar despesa/i }));

    expect(await screen.findByText(/já existe/i)).toBeInTheDocument();
  });
});
