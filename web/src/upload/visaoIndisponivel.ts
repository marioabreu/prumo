import type { VisaoAdapter } from "@prumo/shared";

export const visaoIndisponivel: VisaoAdapter = {
  async extrairDeImagem() {
    throw new Error("A leitura por visão ainda não está disponível — tenta uma fatura com QR legível.");
  },
};
