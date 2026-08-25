# MVP — Despesas por obra

> Contexto do projeto para o Claude Code. Este ficheiro é a fonte de verdade
> das decisões de design — lê-o antes de mexer. Para o estado atual do
> desenvolvimento (o que já está feito, o que falta), ver `docs/features.md`.

---

## 1. O problema e o objetivo

Uma empresa de construção regista hoje as despesas à mão: uma vez por mês, duas
pessoas juntam-se a lançar todas as faturas num Excel, atribuindo cada uma a uma
**obra**, para controlar o custo por obra.

Objetivo do MVP: **eliminar o lançamento manual.** Ler uma fatura (foto **ou**
PDF), extrair os valores, e mapeá-la para uma tabela de despesas, com somatório
por obra. Uma tabela só, para já — o modelo evolui depois.

## 2. A ideia central (a arquitetura numa frase)

A **extração** (QR + visão) faz a leitura; a **revisão humana colapsa numa única
decisão — escolher a obra** — porque a obra é o único campo que *nunca* vem na
fatura. Tudo o resto (NIF, nº, data, base, IVA, total) sai fiável do QR.

Camadas de confiança:
- **PDF/foto + QR** → dados fiscais garantidos, só falta a obra. Revisão de segundos.
- **Sem QR legível** → fallback para modelo de visão, revisão completa dos valores.

## 3. Decisões de design — NÃO reverter sem uma boa razão

1. **Dinheiro é `Decimal`/`NUMERIC`, nunca `Float`.** É uma app de somar cêntimos;
   floats dão erros de arredondamento que destroem a confiança no total. Somatórios
   fazem-se em SQL (`GROUP BY`), não em JS. Na impl. em memória usa-se `number` só
   por conveniência de demo — não copiar isso para produção.
2. **Deduplicação por `nif | numeroFatura | dataFatura`** (constraint única). O
   `ingerirFatura` verifica antes de criar e devolve `duplicada: true` em vez de
   duplicar. Crítico: a mesma fatura pode chegar por foto **e** por email.
3. **Bloqueio de revisão com TTL de 5 min.** São dois revisores em simultâneo; o
   lock impede que ambos revejam a mesma fatura, mas expira para nenhum cartão
   ficar preso se alguém fechar o portátil. Lógica em `lockAtivoDeOutro`.
4. **O original é imutável.** `ficheiroUrl` e `qrRaw` nunca se editam — nem quando
   se corrigem valores (`atualizarValores`). É o que torna a auditoria real.
5. **A sugestão de obra é explicável e tem threshold.** Devolve sempre um `motivo`
   ("3 das últimas 4 faturas deste fornecedor") e, abaixo de `scoreMin` (0.6),
   devolve `null` — **não adivinha**. O custo dos erros é assimétrico: não sugerir
   custa uma tecla; sugerir mal contamina o total da obra em silêncio.
6. **A obra é um valor controlado**, não texto livre — senão o somatório por obra
   parte-se com "Obra X" vs "obra x".
7. **Export CSV/Excel é feature de adoção, não extra.** Eles vivem em Excel;
   poderem continuar a exportar para lá é o que faz aceitarem a ferramenta.
8. **Ingestão por email** (`faturas@empresa.pt` + inbound parse) é o caminho de
   maior valor: o fornecedor manda o PDF, a despesa aparece em `POR_REVER` já
   preenchida, e o revisor só carimba a obra.
9. **Human-in-the-loop de propósito.** A sugestão pré-preenche mas o `motivo` fica
   sempre visível — o objetivo é acelerar, não substituir o julgamento.
10. **A entidade "obra" é genérica no código (`CentroCusto`), com rótulo
    configurável na UI.** O nome interno já não está preso a este cliente —
    outro cliente noutro setor pode chamar-lhe "Projeto" ou "Departamento".
    Por defeito a app continua a mostrar "Obra"/"Obras" (o vocabulário deste
    cliente, guardado em `Configuracao`); o ecrã Definições troca o rótulo
    singular/plural sem deploy. As decisões #5, #6, #8 e #9 acima e a secção 1
    continuam válidas lendo "obra" como o rótulo por defeito de `CentroCusto`.

## 4. Como as camadas ligam

```
extração (QR/visão)  →  schema  →  resolvers (portas Repos)  →  UI React
```

- Os **resolvers não sabem de DB** — falam com a interface `Repos`. Implementa-a
  com Prisma em `server/repos/`. Cada método vira 1–2 linhas de Prisma.
- A porta **`ctx.extrair(ficheiroUrl)`** é onde entra o pipeline de
  `extrair-fatura.ts`.

## 5. Domínio PT — coisas não óbvias

- **QR de faturas certificadas (Portaria 195/2020):** string de pares `Chave:Valor`
  separados por `*`; campos a zero são omitidos. O dicionário de campos completo
  está em `qr-fatura.ts`.
- **O nome do fornecedor NÃO vem no QR** — só o NIF. Resolve-se por uma tabela
  `Fornecedor` (upsert por NIF); no fluxo de email, o remetente ajuda.
- **IVA:** taxas 6% / 13% / 23%; uma fatura pode ter várias. Para o MVP basta
  base/IVA/total; linha por taxa é fase 2.
- **Validação de NIF** por checksum (módulo 11) já está em `qr-fatura.ts`.
- **Nem todos os PDFs têm QR** (recibos manuais, digitalizações) → o fallback de
  visão continua a existir, mas passa a exceção.

## 6. Fora de scope no MVP (fase 2)

Obras como entidade rica (orçamento vs. real), categorias, linhas de fatura por
taxa de IVA, papéis/multi-utilizador, ATCUD/validação fiscal profunda, SAF-T,
integração com contabilidade, e substituir a heurística por um modelo aprendido
(cada confirmação é, na prática, um dado de treino `fornecedor+fatura → obra`).

## 7. Riscos conhecidos

- **Arranque a frio da sugestão:** sem histórico confirmado, quase nada terá
  sugestão nas primeiras semanas. O valor imediato é a extração; a sugestão
  melhora com o uso. Gerir esta expectativa com o cliente.
- **pdf.js em Node é fiddly** (globais de canvas). Preferir decode do QR no browser
  (upload) e usar o adaptador Node só para o pipeline de email.
- **Não montar a UI sobre dados a fingir** — desenvolver sempre contra resolvers
  reais, nunca sobre mocks deixados na UI.
