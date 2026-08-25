-- CreateIndex
CREATE INDEX "Despesa_obraId_idx" ON "Despesa"("obraId");

-- CreateIndex
CREATE INDEX "Despesa_fornecedorId_idx" ON "Despesa"("fornecedorId");

-- CreateIndex
CREATE INDEX "Despesa_nifFornecedor_criadaEm_idx" ON "Despesa"("nifFornecedor", "criadaEm");
