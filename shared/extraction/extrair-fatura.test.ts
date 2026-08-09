import { describe, it, expect, vi } from "vitest";
import { extrairFatura } from "./extrair-fatura.js";
import type { Adaptadores } from "./types.js";

const QR_EXEMPLO =
  "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:x*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:x*R:1*S:x";

describe("extrairFatura", () => {
  it("usa o QR quando é legível — não chama o fallback de visão", async () => {
    const imagemFalsa = {} as ImageData;
    const adaptadores: Adaptadores = {
      rasterizador: { rasterizar: vi.fn().mockResolvedValue([imagemFalsa]) },
      visao: { extrairDeImagem: vi.fn() },
    };
    const resultado = await extrairFatura(new ArrayBuffer(0), "application/pdf", adaptadores, {
      lerQR: vi.fn().mockReturnValue(QR_EXEMPLO),
    });

    expect(resultado.fonte).toBe("qr");
    expect(resultado.nifFornecedor).toBe("502544180");
    expect(adaptadores.visao.extrairDeImagem).not.toHaveBeenCalled();
  });

  it("cai no fallback de visão quando não há QR legível", async () => {
    const imagemFalsa = {} as ImageData;
    const adaptadores: Adaptadores = {
      rasterizador: { rasterizar: vi.fn().mockResolvedValue([imagemFalsa]) },
      visao: {
        extrairDeImagem: vi.fn().mockResolvedValue({
          nifFornecedor: "502544180", numeroFatura: "FT 1", dataFatura: "2026-08-01",
          baseTributavel: "10.00", valorIva: "2.30", valorTotal: "12.30",
        }),
      },
    };
    const resultado = await extrairFatura(new ArrayBuffer(0), "application/pdf", adaptadores, {
      lerQR: vi.fn().mockReturnValue(null),
    });

    expect(resultado.fonte).toBe("visao");
    expect(resultado.qrRaw).toBeNull();
    expect(adaptadores.visao.extrairDeImagem).toHaveBeenCalledTimes(1);
  });
});
