import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { criarReposPrisma } from "./prisma.js";
import { qrParaDespesa } from "@prumo/shared";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.despesa.deleteMany();
  await prisma.fornecedor.deleteMany();
  await prisma.obra.deleteMany();
  await prisma.utilizador.deleteMany();
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

describe("guard de eliminação (FK ON DELETE RESTRICT, real Postgres)", () => {
  it("obras.eliminar rejeita quando há uma despesa associada, e apaga quando não há nenhuma", async () => {
    const repos = criarReposPrisma(prisma);
    const obra = await repos.obras.criar({ nome: "Obra Guard" });
    const despesa = await repos.despesas.criar({
      nifFornecedor: "502544180", numeroFatura: "FT 300", dataFatura: "2026-08-01",
      baseTributavel: "1.00", valorIva: "0.23", valorTotal: "1.23",
      ficheiroUrl: "https://exemplo/f4.pdf", qrRaw: null, origem: "UPLOAD",
    });
    await repos.despesas.atribuirObra(despesa.id, obra.id);

    await expect(repos.obras.eliminar(obra.id)).rejects.toThrow(/despesas associadas/);
    expect(await repos.obras.obterPorId(obra.id)).not.toBeNull();

    const semUso = await repos.obras.criar({ nome: "Obra Sem Uso" });
    await expect(repos.obras.eliminar(semUso.id)).resolves.toBeUndefined();
    expect(await repos.obras.obterPorId(semUso.id)).toBeNull();
  });

  it("fornecedores.eliminar rejeita quando há uma despesa associada via fornecedorId", async () => {
    const repos = criarReposPrisma(prisma);
    const fornecedor = await repos.fornecedores.criar({ nif: "502544180", nome: "Leroy Merlin" });
    await repos.despesas.criar({
      nifFornecedor: fornecedor.nif, fornecedorId: fornecedor.id, numeroFatura: "FT 301",
      dataFatura: "2026-08-01", baseTributavel: "1.00", valorIva: "0.23", valorTotal: "1.23",
      ficheiroUrl: "https://exemplo/f5.pdf", qrRaw: null, origem: "UPLOAD",
    });

    await expect(repos.fornecedores.eliminar(fornecedor.id)).rejects.toThrow(/despesas associadas/);
    expect(await repos.fornecedores.obterPorNif(fornecedor.nif)).not.toBeNull();

    const semUso = await repos.fornecedores.criar({ nif: "241489830" });
    await expect(repos.fornecedores.eliminar(semUso.id)).resolves.toBeUndefined();
  });

  it("ingerirFatura via qrParaDespesa liga fornecedorId — o guard passa a ter algo para bloquear", async () => {
    const repos = criarReposPrisma(prisma);
    const fornecedor = await repos.fornecedores.upsert("502544180");
    const qrRaw = "A:502544180*D:FT*F:20260809*G:FT 900*O:9.99";
    const { nifValido: _nifValido, ...dados } = qrParaDespesa(qrRaw);
    await repos.despesas.criar({
      ...dados, fornecedorId: fornecedor.id, ficheiroUrl: "https://exemplo/f6.pdf", qrRaw, origem: "UPLOAD",
    });

    await expect(repos.fornecedores.eliminar(fornecedor.id)).rejects.toThrow(/despesas associadas/);
  });
});
