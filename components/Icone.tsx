/*
 * Ícones de traço do portal (24 x 24, traço 2, cor = currentColor).
 * Desenhados aqui para não depender de biblioteca: entram só os que as
 * telas usam. Substituem os emojis e símbolos (🔒, ⏱, ⚠) que mudavam de
 * cara em cada sistema operacional.
 */

const DESENHOS = {
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
