-- RenameTable (preserva dados; "Obra" generaliza para "CentroCusto" — ver CLAUDE.md)
ALTER TABLE "Obra" RENAME TO "CentroCusto";
ALTER TABLE "CentroCusto" RENAME CONSTRAINT "Obra_pkey" TO "CentroCusto_pkey";
ALTER INDEX "Obra_nome_key" RENAME TO "CentroCusto_nome_key";

-- RenameColumn
ALTER TABLE "Despesa" RENAME COLUMN "obraId" TO "centroCustoId";
ALTER TABLE "Despesa" RENAME CONSTRAINT "Despesa_obraId_fkey" TO "Despesa_centroCustoId_fkey";
ALTER INDEX "Despesa_obraId_idx" RENAME TO "Despesa_centroCustoId_idx";

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Configuracao_chave_key" ON "Configuracao"("chave");
