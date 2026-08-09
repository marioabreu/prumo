import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider } from "@apollo/client/testing/react";
import { CarregarFaturaScreen } from "./CarregarFaturaScreen.js";
import { INGERIR_FATURA } from "../graphql.js";

function ficheiroFalso(nome = "fatura.pdf", tipo = "application/pdf") {
  return new File(["conteudo"], nome, { type: tipo });
}

const resultadoQrValido = {
  fonte: "qr" as const, qrRaw: "A:502544180*D:FT*F:20260809*G:FT1*O:50.00",
  nifFornecedor: "502544180", numeroFatura: "FT1", dataFatura: "2026-08-09",
  baseTributavel: "40.65", valorIva: "9.35", valorTotal: "50.00", nifValido: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CarregarFaturaScreen", () => {
  it("cria a despesa quando o QR é lido com sucesso", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ url: "http://localhost:4000/files/abc-fatura.pdf" }),
    }));
    const extrair = vi.fn().mockResolvedValue(resultadoQrValido);
    const mocks = [
      {
        request: {
          query: INGERIR_FATURA,
          variables: { ficheiroUrl: "http://localhost:4000/files/abc-fatura.pdf", qrRaw: resultadoQrValido.qrRaw },
        },
        result: { data: { ingerirFatura: { duplicada: false, despesa: { id: "d1", numeroFatura: "FT1", valorTotal: "50.00" } } } },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <CarregarFaturaScreen extrair={extrair} />
      </MockedProvider>
    );

    await user.upload(screen.getByLabelText(/escolher ficheiro/i), ficheiroFalso());

    expect(await screen.findByText(/despesa criada/i)).toBeInTheDocument();
    expect(screen.getByText(/FT1/)).toBeInTheDocument();
  });

  it("mostra erro claro quando não encontra QR legível", async () => {
    const user = userEvent.setup();
    const extrair = vi.fn().mockRejectedValue(
      new Error("A leitura por visão ainda não está disponível — tenta uma fatura com QR legível.")
    );

    render(
      <MockedProvider mocks={[]}>
        <CarregarFaturaScreen extrair={extrair} />
      </MockedProvider>
    );

    await user.upload(screen.getByLabelText(/escolher ficheiro/i), ficheiroFalso());

    expect(await screen.findByText(/leitura por visão ainda não está disponível/i)).toBeInTheDocument();
  });

  it("mostra erro quando o upload do ficheiro falha", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const extrair = vi.fn().mockResolvedValue(resultadoQrValido);

    render(
      <MockedProvider mocks={[]}>
        <CarregarFaturaScreen extrair={extrair} />
      </MockedProvider>
    );

    await user.upload(screen.getByLabelText(/escolher ficheiro/i), ficheiroFalso());

    expect(await screen.findByText(/falha ao enviar/i)).toBeInTheDocument();
  });
});
