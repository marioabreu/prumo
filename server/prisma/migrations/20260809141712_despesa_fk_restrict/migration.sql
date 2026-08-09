-- DropForeignKey
ALTER TABLE "Despesa" DROP CONSTRAINT "Despesa_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "Despesa" DROP CONSTRAINT "Despesa_obraId_fkey";

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
