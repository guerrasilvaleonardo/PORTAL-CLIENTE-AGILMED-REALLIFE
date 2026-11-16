/*
 * Ícones de traço do portal (24 x 24, traço 2, cor = currentColor).
 * Desenhados aqui para não depender de biblioteca: entram só os que as
 * telas usam. Substituem os emojis e símbolos (🔒, ⏱, ⚠) que mudavam de
 * cara em cada sistema operacional.
 */

const DESENHOS = {
  aviso: (
    <>
      <path d="M10.3 4.3L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  prazo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  revisao: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-14 5.3L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
  exportar: (
    <>
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </>
  ),
  assinatura: (
    <>
      <path d="M4 20h16" />
      <path d="M14.5 4.5l3 3L9 16H6v-3z" />
    </>
  ),
  reticencias: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  feito: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 10" />
    </>
  ),
  loja: (
    <>
      <path d="M6 7h12l1 13H5z" />
      <path d="M9 7V6a3 3 0 0 1 6 0v1" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />
    </>
  ),
  prancheta: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4h6v3H9z" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  estetoscopio: (
    <>
      <path d="M6 3v5a5 5 0 0 0 10 0V3" />
      <path d="M11 13v2a5 5 0 0 0 10 0v-1" />
      <circle cx="21" cy="12" r="1.5" />
    </>
  ),
  computador: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  atendimento: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
      <path d="M19 20a3 3 0 0 1-3 2h-3" />
    </>
  ),
  treinamentos: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v6" />
    </>
  ),
  certificados: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.5L7.5 22 12 19.5 16.5 22 15 14.5" />
      <path d="M9.5 9l1.7 1.7L14.5 7.5" />
    </>
  ),
  documentos: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  conversas: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
    </>
  ),
  cadeado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  mais: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  seta: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
} as const

export type NomeIcone = keyof typeof DESENHOS

export default function Icone({ nome, tamanho = 22, rotulo }: { nome: NomeIcone; tamanho?: number; rotulo?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      style={{ flex: 'none' }}
    >
      {DESENHOS[nome]}
    </svg>
  )
}
