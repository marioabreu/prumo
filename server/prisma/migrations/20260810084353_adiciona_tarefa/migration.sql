-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "feita" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);
