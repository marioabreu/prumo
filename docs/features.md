# Checklist de features

Lista viva de sugestões de features para o Prumo. Marca-se `[x]` quando está
feito e a correr em produção (não só em código).

## Feito

- [x] Upload de fatura (foto/PDF) com leitura de QR no browser
- [x] Fila de revisão com sugestão de obra
- [x] CRUD de Obra, Fornecedor, Despesa (parcial), Utilizador
- [x] Toast com todos os dados lidos da fatura após upload
- [x] Fila de revisão atualiza sozinha ao voltar (sem refresh manual)
- [x] Carregar várias faturas de uma vez (upload múltiplo)
- [x] Ícone/favicon próprio da app (plumb bob)
- [x] Contador de faturas por rever na nav (Fila de Revisão)
- [x] Nome/morada do fornecedor via VIES (com fallback nif.pt) + edição manual

## Por fazer

- [ ] Export CSV/Excel das despesas confirmadas (CLAUDE.md #7 — feature de
      adoção, não extra)
- [ ] Ingestão por email (`faturas@empresa.pt`) — maior valor a seguir (CLAUDE.md #8)
- [ ] Subscriptions em tempo real na fila de revisão (dois revisores em
      simultâneo veem a fila atualizar sem navegar)
- [ ] Deploy para servidor de casa com acesso externo (Docker + Cloudflare
      Tunnel) — decisão pendente: implementar já ou só guia de instruções
- [ ] Guardar/expor mais campos do QR além dos já mapeados (`qrRaw` já
      preserva tudo; falta decidir que campos extra valem a pena estruturar,
      ex. ATCUD, tipo de documento)

## Ideias por confirmar

_(sugestões soltas, ainda sem "sim, quero isto")_

---

Para adicionar: basta pedir e eu atualizo este ficheiro.
