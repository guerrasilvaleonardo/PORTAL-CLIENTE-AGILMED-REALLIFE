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
 * Acha a matricula do EAD que corresponde a um certificado.
 * Devolve null quando o colaborador nao tem e-mail, nao tem
 * matricula, ou nenhuma matricula bate com o curso.
 */
export function acharProgresso(
  email: string | null,
  curso: string | null,
  progressos: Progresso[]
): Progresso | null {
  if (!email) return null

  const alvoEmail = email.toLowerCase().trim()

  const doColaborador = progressos.filter(
    (p) => p.email.toLowerCase().trim() === alvoEmail
  )

  if (doColaborador.length === 0) return null

  const maiorPrimeiro = (lista: Progresso[]) =>
    [...lista].sort((a, b) => b.progresso - a.progresso)[0]

  if (!curso) return maiorPrimeiro(doColaborador)

  const alvo = normalizarCurso(curso)

  const exato = doColaborador.find((p) => normalizarCurso(p.curso) === alvo)

  if (exato) return exato

  const nr = numeroDaNr(curso)

  if (nr) {
    const mesmaNr = doColaborador.filter((p) => numeroDaNr(p.curso) === nr)

    if (mesmaNr.length === 0) return null

    const quaisCert = qualificadores(curso)

    const compativeis = mesmaNr.filter((p) => {
      const quaisEad = qualificadores(p.curso)

      if (quaisCert.length > 0) {
        return quaisCert.every((q) => quaisEad.includes(q))
      }

      return quaisEad.length === 0
    })

    return maiorPrimeiro(compativeis.length > 0 ? compativeis : mesmaNr)
  }

  /* Cursos sem NR: Brigada de Incendio, Primeiros Socorros... */
  const palavras = alvo.split(' ').filter((t) => t.length > 3)

  const porPalavra = doColaborador.filter((p) => {
    const texto = normalizarCurso(p.curso)

    return palavras.length > 0 && palavras.every((t) => texto.includes(t))
  })

  if (porPalavra.length === 0) return null

  return maiorPrimeiro(porPalavra)
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
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
