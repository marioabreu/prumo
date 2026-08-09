import { describe, it, expect } from "vitest";
import { descodificarQR, nifValido, qrParaDespesa } from "./qr-fatura.js";

const QR_EXEMPLO =
  "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:JF5FZZJM-118388419*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:iP3C*R:2842*S:TB;PT50001000006336966000130;25.95";

describe("descodificarQR", () => {
  it("descodifica os campos fiscais do exemplo real", () => {
    const f = descodificarQR(QR_EXEMPLO);
    expect(f.nifEmitente).toBe("502544180");
    expect(f.dataDocumento).toBe("2026-07-25");
    expect(f.totalDocumento).toBe(25.95);
    expect(f.tipoDocumentoDescr).toBe("Fatura");
  });
});

describe("nifValido", () => {
  it("aceita um NIF com checksum correto", () => {
    expect(nifValido("502544180")).toBe(true);
  });
  it("rejeita um NIF com checksum errado", () => {
    expect(nifValido("502544181")).toBe(false);
  });
  it("rejeita strings que não são 9 dígitos", () => {
    expect(nifValido("abc")).toBe(false);
  });
});

describe("qrParaDespesa", () => {
  it("mapeia o QR para os campos da despesa em camelCase", () => {
    const despesa = qrParaDespesa(QR_EXEMPLO);
    expect(despesa).toEqual({
      nifFornecedor: "502544180",
      numeroFatura: "FT 101/118388419",
      dataFatura: "2026-07-25",
      baseTributavel: "21.09",
      valorIva: "4.86",
      valorTotal: "25.95",
      nifValido: true,
    });
  });
});
