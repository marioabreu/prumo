// ─────────────────────────────────────────────────────────────────────────────
// Descodificador do QR Code de faturas certificadas (Portaria 195/2020)
//
// A string do QR é texto simples: pares "Chave:Valor" separados por "*".
// Campos a zero são omitidos. Os códigos internos (tipo de documento, IVA)
// vêm da estrutura SAF-T (PT).
// ─────────────────────────────────────────────────────────────────────────────

type CampoTipo = "string" | "numero" | "data";

interface DefCampo {
  nome: string;
  tipo: CampoTipo;
}

// Dicionário completo dos campos do QR.
// Blocos I* (continente), J* (Açores), K* (Madeira) seguem todos o mesmo padrão:
//   x1 = espaço fiscal | x2 = isento | x3/x4 = reduzida | x5/x6 = intermédia | x7/x8 = normal
const CAMPOS: Record<string, DefCampo> = {
  A:  { nome: "nifEmitente",       tipo: "string" },
  B:  { nome: "nifAdquirente",     tipo: "string" },
  C:  { nome: "paisAdquirente",    tipo: "string" },
  D:  { nome: "tipoDocumento",     tipo: "string" },
  E:  { nome: "estadoDocumento",   tipo: "string" },
  F:  { nome: "dataDocumento",     tipo: "data"   },
  G:  { nome: "idDocumento",       tipo: "string" },
  H:  { nome: "atcud",             tipo: "string" },

  I1: { nome: "espacoFiscalPT",    tipo: "string" },
  I2: { nome: "baseIsentaPT",      tipo: "numero" },
  I3: { nome: "baseReduzidaPT",    tipo: "numero" },
  I4: { nome: "ivaReduzidaPT",     tipo: "numero" },
  I5: { nome: "baseIntermediaPT",  tipo: "numero" },
  I6: { nome: "ivaIntermediaPT",   tipo: "numero" },
  I7: { nome: "baseNormalPT",      tipo: "numero" },
  I8: { nome: "ivaNormalPT",       tipo: "numero" },

  J1: { nome: "espacoFiscalAC",    tipo: "string" },
  J2: { nome: "baseIsentaAC",      tipo: "numero" },
  J3: { nome: "baseReduzidaAC",    tipo: "numero" },
  J4: { nome: "ivaReduzidaAC",     tipo: "numero" },
  J5: { nome: "baseIntermediaAC",  tipo: "numero" },
  J6: { nome: "ivaIntermediaAC",   tipo: "numero" },
  J7: { nome: "baseNormalAC",      tipo: "numero" },
  J8: { nome: "ivaNormalAC",       tipo: "numero" },

  K1: { nome: "espacoFiscalMA",    tipo: "string" },
  K2: { nome: "baseIsentaMA",      tipo: "numero" },
  K3: { nome: "baseReduzidaMA",    tipo: "numero" },
  K4: { nome: "ivaReduzidaMA",     tipo: "numero" },
  K5: { nome: "baseIntermediaMA",  tipo: "numero" },
  K6: { nome: "ivaIntermediaMA",   tipo: "numero" },
  K7: { nome: "baseNormalMA",      tipo: "numero" },
  K8: { nome: "ivaNormalMA",       tipo: "numero" },

  L:  { nome: "naoSujeito",        tipo: "numero" },
  M:  { nome: "impostoSelo",       tipo: "numero" },
  N:  { nome: "totalImpostos",     tipo: "numero" }, // IVA + imposto de selo
  O:  { nome: "totalDocumento",    tipo: "numero" },
  P:  { nome: "retencoes",         tipo: "numero" },
  Q:  { nome: "hashAssinatura",    tipo: "string" },
  R:  { nome: "numeroCertificado", tipo: "string" },
  S:  { nome: "outrasInformacoes", tipo: "string" }, // texto livre; costuma trazer IBAN/ref.
};

// Expansão dos tipos de documento mais comuns (campo D)
const TIPOS_DOCUMENTO: Record<string, string> = {
  FT: "Fatura",
  FS: "Fatura simplificada",
  FR: "Fatura-recibo",
  ND: "Nota de débito",
  NC: "Nota de crédito",
  VD: "Venda a dinheiro",
  TV: "Talão de venda",
  RG: "Recibo",
};

export interface FaturaQR {
  nifEmitente: string;
  tipoDocumento: string;
  tipoDocumentoDescr?: string;
  estadoDocumento: string;
  dataDocumento: string; // AAAA-MM-DD
  idDocumento: string;
  atcud: string;
  totalDocumento: number;
  [campo: string]: string | number | undefined;
}

/** Passo 1-3: parte a string e devolve um objeto tipado. */
export function descodificarQR(qr: string): FaturaQR {
  const out: Record<string, string | number> = {};

  for (const parte of qr.split("*")) {
    const sep = parte.indexOf(":");        // só o PRIMEIRO ":" — o campo S pode ter mais
    if (sep === -1) continue;

    const chave = parte.slice(0, sep);
    const bruto = parte.slice(sep + 1);
    const def = CAMPOS[chave];

    if (!def) { out[chave] = bruto; continue; } // campo desconhecido → guarda em bruto

    if (def.tipo === "numero") {
      out[def.nome] = Number.parseFloat(bruto);
    } else if (def.tipo === "data") {
      out[def.nome] = `${bruto.slice(0, 4)}-${bruto.slice(4, 6)}-${bruto.slice(6, 8)}`;
    } else {
      out[def.nome] = bruto;
    }
  }

  if (typeof out.tipoDocumento === "string") {
    out.tipoDocumentoDescr = TIPOS_DOCUMENTO[out.tipoDocumento] ?? out.tipoDocumento;
  }

  return out as FaturaQR;
}

/** Validação do NIF português pelo dígito de controlo (módulo 11). */
export function nifValido(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const d = nif.split("").map(Number);
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += d[i] * (9 - i);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === d[8];
}

// Soma das bases tributáveis das três regiões
function somaBases(f: FaturaQR): number {
  const campos = [
    "baseIsentaPT", "baseReduzidaPT", "baseIntermediaPT", "baseNormalPT",
    "baseIsentaAC", "baseReduzidaAC", "baseIntermediaAC", "baseNormalAC",
    "baseIsentaMA", "baseReduzidaMA", "baseIntermediaMA", "baseNormalMA",
  ];
  return campos.reduce((s, c) => s + (Number(f[c]) || 0), 0);
}

// Soma do IVA (só IVA, sem imposto de selo)
function somaIVA(f: FaturaQR): number {
  const campos = [
    "ivaReduzidaPT", "ivaIntermediaPT", "ivaNormalPT",
    "ivaReduzidaAC", "ivaIntermediaAC", "ivaNormalAC",
    "ivaReduzidaMA", "ivaIntermediaMA", "ivaNormalMA",
  ];
  return campos.reduce((s, c) => s + (Number(f[c]) || 0), 0);
}

/** Mapeia o QR descodificado para os campos da tabela `despesas` (camelCase, consistente com o resto do domínio). */
export function qrParaDespesa(qr: string) {
  const f = descodificarQR(qr);
  return {
    nifFornecedor: f.nifEmitente,        // ATENÇÃO: o nome NÃO vem no QR — só o NIF (ver nota)
    numeroFatura: f.idDocumento,
    dataFatura: f.dataDocumento,         // AAAA-MM-DD
    baseTributavel: somaBases(f).toFixed(2),
    valorIva: somaIVA(f).toFixed(2),
    valorTotal: Number(f.totalDocumento).toFixed(2),
    nifValido: nifValido(f.nifEmitente ?? ""),
  };
}

// ── Exemplo ──────────────────────────────────────────────────────────────────
// const qr = "A:502544180*B:241489830*C:PT*D:FT*E:N*F:20260725*G:FT 101/118388419*H:JF5FZZJM-118388419*I1:PT*I7:21.09*I8:4.86*N:4.86*O:25.95*Q:iP3C*R:2842*S:TB;PT50001000006336966000130;25.95";
// console.log(qrParaDespesa(qr));
// → { nifFornecedor: "502544180", numeroFatura: "FT 101/118388419",
//     dataFatura: "2026-07-25", baseTributavel: "21.09", valorIva: "4.86",
//     valorTotal: "25.95", nifValido: true }
