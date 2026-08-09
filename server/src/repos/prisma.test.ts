import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

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
