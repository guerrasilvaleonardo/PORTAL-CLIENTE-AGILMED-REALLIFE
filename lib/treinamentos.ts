/*
 * Casamento entre o certificado cadastrado aqui e a matricula no EAD.
 *
 * O nome do curso no Maestrus quase nunca e igual ao que a equipe
 * digita no portal ("NR 18 | CONSTRUCAO CIVIL" x "NR | 18 | -
 * Condicoes de Seguranca..."). Entao comparamos pelo numero da NR e
 * pelos qualificadores, com o texto limpo de acento e pontuacao.
 *
 * Fica em lib/ porque a tela de Certificados e o relatorio de
 * Treinamentos usam exatamente a mesma regra — se divergirem, os
 * dois numeros param de bater e ninguem confia em nenhum dos dois.
 */

export type Progresso = {
  email: string
  curso: string
  progresso: number
  situacao: string | null
  atualizado_em: string
  /* Data de inicio da matricula no EAD (AAAA-MM-DD). */
  inicio?: string | null
  /* 'manual' quando veio do lancamento presencial, nao do EAD. */
  origem?: OrigemProgresso
}

/*
 * De onde vem o progresso do certificado:
 *   'ead'    -> Maestrus; a leitura das 06h atualiza sozinha
 *   'manual' -> treinamento presencial; a equipe informa a etapa
 */
export type OrigemProgresso = 'ead' | 'manual'

export type EtapaManual = 'agendado' | 'em_andamento' | 'concluido'

export const ETAPAS_MANUAIS: EtapaManual[] = [
  'agendado',
  'em_andamento',
  'concluido',
]

export const ROTULO_ETAPA_MANUAL: Record<EtapaManual, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

/* O que um certificado precisa ter para sabermos o progresso dele. */
export type CertificadoComProgresso = {
  id?: string
  email_colaborador: string | null
  emissao?: string | null
  validade?: string | null
  link_certificado?: string | null
  created_at?: string | null
  curso: string | null
  progresso_origem?: OrigemProgresso | null
  progresso_etapa?: EtapaManual | null
  progresso_manual?: number | null
  progresso_manual_em?: string | null
}

/*
 * Percentual que vale para um lancamento manual. "Concluido" e sempre
 * 100%; sem percentual informado, a etapa decide.
 */
export function percentualManual(
  etapa: EtapaManual | null | undefined,
  percentual: number | null | undefined
) {
  if (etapa === 'concluido') return 100
  if (typeof percentual === 'number') return Math.max(0, Math.min(100, percentual))

  return 0
}

/*
 * Progresso de um certificado, qualquer que seja a origem. Certificados
 * e Treinamentos chamam SEMPRE esta funcao, para os numeros baterem.
 */
export function progressoDoCertificado(
  c: CertificadoComProgresso,
  progressos: Progresso[]
): Progresso | null {
  if (c.progresso_origem === 'manual') {
    const etapa = c.progresso_etapa || 'agendado'

    return {
      email: c.email_colaborador || '',
      curso: c.curso || '',
      progresso: percentualManual(etapa, c.progresso_manual),
      situacao: ROTULO_ETAPA_MANUAL[etapa],
      atualizado_em: c.progresso_manual_em || '',
      origem: 'manual',
    }
  }

  const doEad = acharProgresso(c.email_colaborador, c.curso, progressos)

  return doEad ? { ...doEad, origem: 'ead' } : null
}

/* Sugestoes do campo de curso. O campo aceita qualquer texto. */
export const CURSOS = [
  'NR 05 | CIPA',
  'NR 06 | EPI',
  'NR 10 | BÁSICO',
  'NR 10 | COMPLEMENTAR SEP',
  'NR 10 | RECICLAGEM',
  'NR 11 | OPERAÇÃO DE EMPILHADEIRA',
  'NR 12 | SEGURANÇA EM MÁQUINAS E EQUIPAMENTOS',
  'NR 13 | CALDEIRAS E VASOS DE PRESSÃO',
  'NR 17 | ERGONOMIA',
  'NR 18 | CONSTRUÇÃO CIVIL',
  'NR 20 | INFLAMÁVEIS E COMBUSTÍVEIS',
  'NR 23 | PREVENÇÃO E COMBATE A INCÊNDIO',
  'NR 33 | ESPAÇOS CONFINADOS',
  'NR 33 | SUPERVISOR DE ENTRADA',
  'NR 34 | INDÚSTRIA NAVAL',
  'NR 35 | TRABALHO EM ALTURA',
  'NR 35 | SUPERVISOR DE TRABALHO EM ALTURA',
  'BRIGADA DE INCÊNDIO',
  'PRIMEIROS SOCORROS',
  'INTEGRAÇÃO DE SEGURANÇA',
]

/* "NR |10 | Reciclagem" vira "NR 10 RECICLAGEM". */
export function normalizarCurso(texto: string) {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function numeroDaNr(texto: string) {
  const achado = normalizarCurso(texto).match(/\bNR 0?(\d{1,2})\b/)

  return achado ? achado[1] : null
}

const QUALIFICADORES = [
  'COMPLEMENTAR',
  'SEP',
  'RECICLAGEM',
  'SUPERVISOR',
  'BASICO',
  'AVANCADO',
  'INTERMEDIARIO',
  'VIGIA',
  'AUTORIZADO',
  'ENTRADA',
  'FORMACAO',
  'INICIAL',
]

export function qualificadores(texto: string) {
  const normalizado = normalizarCurso(texto)

  return QUALIFICADORES.filter((q) => normalizado.includes(q))
}

/*
 * Todas as matriculas do EAD que podem corresponder a um certificado.
 * Lista vazia quando o colaborador nao tem e-mail, nao tem matricula,
 * ou nenhuma matricula bate com o curso.
 *
 * O mesmo curso pode aparecer mais de uma vez (ex.: NR 33 feito em
 * 2025 e liberado de novo em 2026). Por isso devolvemos todas — quem
 * decide qual vai para qual certificado e progressosDosCertificados.
 */
export function candidatosDoCurso(
  email: string | null,
  curso: string | null,
  progressos: Progresso[]
): Progresso[] {
  if (!email) return []

  const alvoEmail = email.toLowerCase().trim()

  const todas = progressos.filter(
    (p) => p.email.toLowerCase().trim() === alvoEmail
  )

  /*
   * Vale so a ultima leitura do EAD para este colaborador. Linhas que a
   * leitura mais recente nao tocou (ex.: a linha unica gravada antes de
   * separarmos matriculas repetidas) ficam de fora, para nao virarem uma
   * "matricula fantasma".
   */
  const ultima = todas.reduce(
    (max, p) => ((p.atualizado_em || '') > max ? p.atualizado_em || '' : max),
    ''
  )

  const doColaborador = todas.filter(
    (p) => (p.atualizado_em || '') === ultima
  )

  if (doColaborador.length === 0) return []

  if (!curso) return doColaborador

  const alvo = normalizarCurso(curso)

  const exatos = doColaborador.filter((p) => normalizarCurso(p.curso) === alvo)

  if (exatos.length > 0) return exatos

  const nr = numeroDaNr(curso)

  if (nr) {
    const mesmaNr = doColaborador.filter((p) => numeroDaNr(p.curso) === nr)

    /*
     * O EAD nem sempre põe "NR xx" no nome do curso ("Integração de
     * Segurança e Saúde Ocupacional", "Segurança na Operação de Ponte
     * Rolante"). Nesse caso compara pelas palavras, só com cursos do EAD
     * que não citam outra NR.
     */
    if (mesmaNr.length === 0) return porPalavras(curso, doColaborador)

    const quaisCert = qualificadores(curso)

    const compativeis = mesmaNr.filter((p) => {
      const quaisEad = qualificadores(p.curso)

      if (quaisCert.length > 0) {
        return quaisCert.every((q) => quaisEad.includes(q))
      }

      return quaisEad.length === 0
    })

    return compativeis.length > 0 ? compativeis : mesmaNr
  }

  /* Cursos sem NR: Brigada de Incendio, Primeiros Socorros... */
  const palavras = alvo.split(' ').filter((t) => t.length > 3)

  return doColaborador.filter((p) => {
    const texto = normalizarCurso(p.curso)

    return palavras.length > 0 && palavras.every((t) => texto.includes(t))
  })
}

/* Palavras comuns demais para identificar um curso. */
const PALAVRAS_GENERICAS = new Set(['SEGURANCA', 'TRABALHO', 'TRABALHOS', 'SOBRE', 'PARA', 'COM', 'CURSO', 'TREINAMENTO'])

function palavrasDoCurso(texto: string) {
  return normalizarCurso(texto)
    .split(' ')
    .filter((t) => t.length > 3 && !/^\d+$/.test(t) && !PALAVRAS_GENERICAS.has(t) && !QUALIFICADORES.includes(t))
}

/*
 * Certificado com NR cujo curso no EAD não cita NR: casa quando pelo
 * menos 2 palavras próprias do curso aparecem e elas são a maioria.
 * Ex.: "NR 11 PONTE ROLANTE E PÓRTICO" x "Segurança na Operação de
 * Ponte Rolante" (PONTE, ROLANTE: 2 de 3).
 */
function porPalavras(curso: string, doColaborador: Progresso[]) {
  const palavras = palavrasDoCurso(curso)

  if (palavras.length < 2) return []

  return doColaborador.filter((p) => {
    if (numeroDaNr(p.curso)) return false

    const texto = ' ' + normalizarCurso(p.curso) + ' '
    const achadas = palavras.filter((t) => texto.includes(' ' + t + ' ')).length

    return achadas >= 2 && achadas * 2 > palavras.length
  })
}

function maiorProgresso(lista: Progresso[]) {
  return [...lista].sort((a, b) => b.progresso - a.progresso)[0] || null
}

/* Matricula de maior andamento entre as que batem com o curso. */
export function acharProgresso(
  email: string | null,
  curso: string | null,
  progressos: Progresso[]
): Progresso | null {
  return maiorProgresso(candidatosDoCurso(email, curso, progressos))
}

/* Certificado ja emitido: tem emissao, validade ou arquivo. */
function jaEmitido(c: CertificadoComProgresso) {
  return Boolean(c.emissao || c.validade || c.link_certificado)
}

function chaveDaMatricula(p: Progresso) {
  return [
    p.email.toLowerCase().trim(),
    normalizarCurso(p.curso),
    p.inicio || '',
  ].join('|')
}

/*
 * Progresso de cada certificado, sem que dois certificados dividam a
 * mesma matricula do EAD.
 *
 * Regra:
 *   1. Certificados ja emitidos escolhem primeiro (do mais antigo para
 *      o mais novo). Cada um fica com a matricula mais adiantada entre
 *      as iniciadas ate a data de emissao; sem data, a mais adiantada.
 *   2. Os demais (recem-liberados) ficam com a matricula mais recente
 *      que sobrou.
 *   3. Se nao sobrar nenhuma, o certificado fica "Sem matricula" — em
 *      vez de copiar o percentual de outro certificado.
 *
 * Certificados e Treinamentos chamam SEMPRE esta funcao, para os
 * numeros baterem.
 */
export function progressosDosCertificados<T extends CertificadoComProgresso>(
  certificados: T[],
  progressos: Progresso[]
): Map<T, Progresso | null> {
  const resultado = new Map<T, Progresso | null>()
  const usadas = new Set<string>()

  const doEad = certificados.filter((c) => {
    if (c.progresso_origem === 'manual') {
      resultado.set(c, progressoDoCertificado(c, progressos))
      return false
    }

    return true
  })

  const data = (v: string | null | undefined) => v || ''

  const emitidos = doEad
    .filter(jaEmitido)
    .sort((a, b) =>
      (data(a.emissao) || '9999').localeCompare(data(b.emissao) || '9999') ||
      data(a.created_at).localeCompare(data(b.created_at))
    )

  const novos = doEad
    .filter((c) => !jaEmitido(c))
    .sort((a, b) => data(b.created_at).localeCompare(data(a.created_at)))

  for (const c of emitidos) {
    const livres = candidatosDoCurso(c.email_colaborador, c.curso, progressos)
      .filter((p) => !usadas.has(chaveDaMatricula(p)))

    const ate = c.emissao
      ? livres.filter((p) => !p.inicio || p.inicio <= (c.emissao as string))
      : []

    const escolhida = maiorProgresso(ate.length > 0 ? ate : livres)

    if (escolhida) usadas.add(chaveDaMatricula(escolhida))

    resultado.set(c, escolhida ? { ...escolhida, origem: 'ead' } : null)
  }

  for (const c of novos) {
    const livres = candidatosDoCurso(c.email_colaborador, c.curso, progressos)
      .filter((p) => !usadas.has(chaveDaMatricula(p)))
      .sort(
        (a, b) =>
          data(b.inicio).localeCompare(data(a.inicio)) ||
          b.progresso - a.progresso
      )

    const escolhida = livres[0] || null

    if (escolhida) usadas.add(chaveDaMatricula(escolhida))

    resultado.set(c, escolhida ? { ...escolhida, origem: 'ead' } : null)
  }

  return resultado
}

/*
 * Concluiu 100% no EAD (Maestrus) e o certificado ainda não foi
 * atualizado no portal. Vale quando:
 *   - o certificado ainda não foi emitido (sem emissão, validade nem
 *     arquivo), ou
 *   - a matrícula concluída começou DEPOIS da emissão registrada
 *     (reciclagem feita, certificado antigo ainda no lugar).
 * Para de valer sozinho quando a equipe lança a nova emissão/arquivo.
 * Presencial (manual) fica de fora: a própria equipe marca "Concluído".
 */
export function aguardandoCertificado(
  c: CertificadoComProgresso,
  p: Progresso | null
): boolean {
  if (c.progresso_origem === 'manual') return false
  if (!p || p.origem === 'manual' || p.progresso < 100) return false
  if (!jaEmitido(c)) return true

  return Boolean(p.inicio && c.emissao && p.inicio > c.emissao)
}

export type Etapa = 'concluido' | 'andamento' | 'nao_iniciado' | 'sem_dados'

/* Em que ponto o colaborador esta naquele curso. */
export function etapaDoProgresso(registro: Progresso | null): Etapa {
  if (!registro) return 'sem_dados'
  if (registro.progresso >= 100) return 'concluido'
  if (registro.progresso > 0) return 'andamento'

  return 'nao_iniciado'
}

export const ROTULO_ETAPA: Record<Etapa, string> = {
  concluido: 'Concluído',
  andamento: 'Em andamento',
  nao_iniciado: 'Não iniciado',
  sem_dados: 'Sem matrícula',
}

/* Classe do pill do sistema visual, por etapa. */
export const PILL_ETAPA: Record<Etapa, string> = {
  concluido: 'pill good',
  andamento: 'pill warn',
  nao_iniciado: 'pill flat',
  sem_dados: 'pill flat',
}

export function corDoProgresso(valor: number) {
  if (valor >= 100) return 'var(--success)'
  if (valor > 0) return 'var(--amber)'

  return 'var(--ink-faint)'
}

export function formatarDataHora(iso: string | null) {
  if (!iso) return '—'

  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Porto_Velho',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
