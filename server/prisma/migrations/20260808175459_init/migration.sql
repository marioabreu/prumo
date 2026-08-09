-- CreateEnum
CREATE TYPE "EstadoDespesa" AS ENUM ('POR_REVER', 'CONFIRMADA', 'ADIADA');

-- CreateEnum
CREATE TYPE "OrigemDespesa" AS ENUM ('UPLOAD', 'EMAIL');

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "nome" TEXT,
    "morada" TEXT,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilizador" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Utilizador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "nifFornecedor" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "numeroFatura" TEXT NOT NULL,
    "dataFatura" TEXT NOT NULL,
    "baseTributavel" DECIMAL(12,2) NOT NULL,
    "valorIva" DECIMAL(12,2) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "ficheiroUrl" TEXT NOT NULL,
    "qrRaw" TEXT,
    "origem" "OrigemDespesa" NOT NULL DEFAULT 'UPLOAD',
    "obraId" TEXT,
    "estado" "EstadoDespesa" NOT NULL DEFAULT 'POR_REVER',
    "lockPorId" TEXT,
    "lockExpiraEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Obra_nome_key" ON "Obra"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_nif_key" ON "Fornecedor"("nif");

-- CreateIndex
CREATE UNIQUE INDEX "Utilizador_email_key" ON "Utilizador"("email");

-- CreateIndex
CREATE INDEX "Despesa_estado_idx" ON "Despesa"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Despesa_nifFornecedor_numeroFatura_dataFatura_key" ON "Despesa"("nifFornecedor", "numeroFatura", "dataFatura");

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
