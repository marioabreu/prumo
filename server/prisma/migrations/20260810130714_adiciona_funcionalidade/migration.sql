-- CreateTable
CREATE TABLE "Funcionalidade" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Funcionalidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Funcionalidade_chave_key" ON "Funcionalidade"("chave");
