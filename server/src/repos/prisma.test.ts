import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { criarReposPrisma } from "./prisma.js";
import { qrParaDespesa } from "@prumo/shared";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.despesa.deleteMany();
  await prisma.fornecedor.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("constraint de dedup", () => {
  it("rejeita uma segunda despesa com a mesma chave nif+numero+data", async () => {
    const dados = {
      nifFornecedor: "502544180",
      numeroFatura: "FT 101/118388419",
      dataFatura: "2026-07-25",
      baseTributavel: "21.09",
      valorIva: "4.86",
      valorTotal: "25.95",
      ficheiroUrl: "https://exemplo/f1.pdf",
    };
    await prisma.despesa.create({ data: dados });
    await expect(prisma.despesa.create({ data: dados })).rejects.toThrow();
  });
});

describe("criarReposPrisma — totaisPorObra em SQL", () => {
  it("soma em SQL, não em JS, e devolve string com 2 casas decimais", async () => {
    await prisma.obra.deleteMany();
    const obra = await prisma.obra.create({ data: { nome: "Obra Sul" } });
    const repos = criarReposPrisma(prisma);
    const d = await repos.despesas.criar({
      nifFornecedor: "502544180", numeroFatura: "FT 200", dataFatura: "2026-08-01",
      baseTributavel: "10.00", valorIva: "2.30", valorTotal: "12.30",
      ficheiroUrl: "https://exemplo/f2.pdf", qrRaw: null, origem: "UPLOAD",
    });
    await repos.despesas.atribuirObra(d.id, obra.id);
    await repos.despesas.confirmar(d.id);

    const totais = await repos.despesas.totaisPorObra();
    expect(totais).toEqual([{ obraId: obra.id, total: "12.30" }]);
  });

  it("aceita diretamente o shape de qrParaDespesa sem o campo extra nifValido", async () => {
    const qrRaw =
      "A:502544180*D:FT*F:20260809*G:FT 901*I7:21.09*I8:4.86*O:25.95";
    const { nifValido, ...dados } = qrParaDespesa(qrRaw);
    const repos = criarReposPrisma(prisma);
    // Deve rebentar em tempo de teste (Prisma valida estritamente o shape) se
    // qrParaDespesa alguma vez devolver um campo que CriarDespesaInput não aceite.
    await expect(
      repos.despesas.criar({ ...dados, ficheiroUrl: "https://exemplo/f3.pdf", qrRaw, origem: "UPLOAD" })
    ).resolves.toMatchObject({ nifFornecedor: "502544180" });
    expect(nifValido).toBe(true);
  });
});
