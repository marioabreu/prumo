import { describe, it, expect } from "vitest";
import { resolvers } from "./resolvers.js";
import { criarReposMemoria } from "./repos/memoria.js";
import { criarLoaders } from "./loaders/index.js";

function ctxDeTeste(seedObras: { nome: string; ativa: boolean }[] = []) {
  const repos = criarReposMemoria(seedObras);
  return { repos, loaders: criarLoaders(repos), extrair: async () => { throw new Error("não usado neste teste"); } };
}

describe("Mutation.ingerirFatura", () => {
  const qrRaw =
    "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:x*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:x*R:1*S:x";

  it("cria uma despesa POR_REVER a partir do QR e não marca como duplicada da primeira vez", async () => {
    const ctx = ctxDeTeste();
    const resultado = await resolvers.Mutation.ingerirFatura(
      {}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx
    );
    expect(resultado.duplicada).toBe(false);
    expect(resultado.despesa.estado).toBe("POR_REVER");
    expect(resultado.despesa.nifFornecedor).toBe("502544180");
  });

  it("devolve duplicada:true na segunda ingestão da mesma chave, sem criar outra despesa", async () => {
    const ctx = ctxDeTeste();
    await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f.pdf", qrRaw }, ctx);
    const segunda = await resolvers.Mutation.ingerirFatura({}, { ficheiroUrl: "https://x/f2.pdf", qrRaw }, ctx);
    expect(segunda.duplicada).toBe(true);
    const fila = await ctx.repos.despesas.listarFila();
    expect(fila).toHaveLength(1);
  });
});

describe("fluxo de revisão ponta-a-ponta", () => {
  it("bloquear -> atribuirObra -> confirmar reflete-se em totaisPorObra", async () => {
    const ctx = ctxDeTeste([{ nome: "Obra Norte", ativa: true }]);
    const [obra] = await ctx.repos.obras.listar();
    const { despesa } = await resolvers.Mutation.ingerirFatura(
      {}, { ficheiroUrl: "https://x/f.pdf", qrRaw: "A:502544180*D:FT*F:20260725*G:FT1*O:25.95" }, ctx
    );

    await resolvers.Mutation.bloquear({}, { despesaId: despesa.id, utilizadorId: "user-1" }, ctx);
    await resolvers.Mutation.atribuirObra({}, { despesaId: despesa.id, obraId: obra.id }, ctx);
    const confirmada = await resolvers.Mutation.confirmar({}, { despesaId: despesa.id }, ctx);
    expect(confirmada.estado).toBe("CONFIRMADA");

    const totais = await resolvers.Query.totaisPorObra({}, {}, ctx);
    expect(totais).toEqual([{ obra, total: "25.95" }]);
  });
});
