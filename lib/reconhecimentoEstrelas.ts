/*
 * Programa de Estrelas: e-mails mensais de reconhecimento.
 *
 * Os modelos ficam aqui, sem acesso ao banco, para a tela (prévia) e a
 * rota de envio (servidor) montarem exatamente o mesmo texto.
 * Tabela e permissões: supabase/estrelas-reconhecimento-mensal.sql.
 */

export type AcaoReconhecimento = 'email' | 'conversa' | 'nao_enviar'

export type Reconhecimento = {
  id: number
  periodo: string
  atendente_id: string
  nome: string
  email: string | null
  posicao: number
  empatado: boolean
  total: number
  estrelas_prazo: number
  estrelas_avaliacao: number
  resolvidos: number
  dentro_prazo: number
  fora_prazo: number
  avaliados: number
  ruins: number
  media_nota: number | null
  acao: AcaoReconhecimento
  motivo_conversa: string | null
  destaque: string | null
  complemento: string | null
  situacao: 'rascunho' | 'enviado'
  assunto_enviado: string | null
  enviado_em: string | null
  erro_envio: string | null
  congelado_em: string
}

export const ROTULO_ACAO: Record<AcaoReconhecimento, string> = {
  email: 'Enviar e-mail',
  conversa: 'Conversa pessoal (sem e-mail)',
  nao_enviar: 'Não enviar',
}

const MESES_MINUSCULO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/* "2026-10-01" -> { mes: "outubro", mesAno: "outubro de 2026" } */
export function nomeDoPeriodo(periodo: string) {
  const [ano, mes] = periodo.slice(0, 7).split('-').map(Number)
  const nome = MESES_MINUSCULO[(mes || 1) - 1]
  return { mes: nome, mesAno: nome + ' de ' + ano }
}

export function ehPodio(r: Pick<Reconhecimento, 'posicao'>) {
  return r.posicao >= 1 && r.posicao <= 3
}

export function primeiroNome(nome: string) {
  return String(nome || '').trim().split(/\s+/)[0] || nome
}

/* Texto livre do gestor termina com pontuação, para emendar na frase seguinte. */
function comPonto(texto: string | null | undefined) {
  const t = String(texto || '').trim()
  if (!t) return ''
  return /[.!?…)"”]$/.test(t) ? t : t + '.'
}

function plural(n: number, um: string, varios: string) {
  return n + ' ' + (n === 1 ? um : varios)
}

/* A mesma linha em todos os modelos: só os números da própria pessoa. */
export function linhaDeNumeros(r: Reconhecimento) {
  const { mesAno } = nomeDoPeriodo(r.periodo)
  const estrelas =
    plural(r.total, 'estrela', 'estrelas') +
    ' (' + r.estrelas_prazo + ' de prazo + ' + r.estrelas_avaliacao + ' de avaliação)'
  const chamados =
    plural(r.resolvidos, 'chamado resolvido', 'chamados resolvidos') + ', ' + r.dentro_prazo + ' no prazo'
  const media =
    r.media_nota === null || r.media_nota === undefined
      ? ''
      : ', média ' +
        Number(r.media_nota).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
        ' de 3'
  const avaliacoes = r.avaliados
    ? plural(r.avaliados, 'avaliação de cliente', 'avaliações de clientes') + media
    : 'nenhuma avaliação de cliente'

  return 'Seus números em ' + mesAno + ': ' + estrelas + ' · ' + chamados + ' · ' + avaliacoes + '.'
}

export type EmailMontado = {
  assunto: string
  /* Parágrafos em texto puro; o HTML é montado (com escape) só no envio. */
  paragrafos: string[]
  /* Parágrafo de números, mostrado em destaque. */
  numeros: string | null
  pendencias: string[]
}

export function montarReconhecimento(r: Reconhecimento, assinatura: string): EmailMontado {
  const nome = primeiroNome(r.nome)
  const { mes, mesAno } = nomeDoPeriodo(r.periodo)
  const destaque = comPonto(r.destaque)
  const complemento = comPonto(r.complemento)
  const numeros = r.total > 0 || r.resolvidos > 0 ? linhaDeNumeros(r) : null
  const empate = r.empatado ? ', empatado com outro colega da equipe' : ''
  const pendencias: string[] = []

  if (!r.email) pendencias.push('Pessoa sem e-mail cadastrado.')
  if (ehPodio(r) && !destaque) pendencias.push('Escreva o destaque do mês (obrigatório no pódio).')

  const marcaDestaque = destaque || '[destaque do mês]'
  const p: string[] = []
  let assunto = ''

  if (r.posicao === 1) {
    assunto = nome + ', parabéns pelo 1º lugar no Programa de Estrelas de ' + mes + '!'
    p.push('Olá, ' + nome + '!')
    p.push(
      'Você conquistou o 1º lugar no Programa de Estrelas de ' + mesAno + empate +
        ', apurado pelos registros do Portal do Cliente. Parabéns!'
    )
    p.push('§NUMEROS')
    if (complemento) p.push(complemento)
    p.push(
      'Por trás desses números, um ponto merece ser dito com todas as letras: ' + marcaDestaque +
        ' Esse resultado foi construído no trabalho de todos os dias, em cada solicitação que você assumiu e acompanhou até o fim.'
    )
    p.push(
      'Espero que, ao olhar para este mês, você também reconheça o mérito do que construiu. Fico feliz em poder dizer isso diretamente a você.'
    )
  } else if (r.posicao === 2) {
    assunto = nome + ', seu trabalho conquistou o 2º lugar no Programa de Estrelas'
    p.push('Olá, ' + nome + '!')
    p.push(
      'Com o fechamento de ' + mesAno + ', quero compartilhar uma conquista sua: você ficou em 2º lugar no Programa de Estrelas' +
        empate + '!'
    )
    p.push('§NUMEROS')
    if (complemento) p.push(complemento)
    p.push('Ao revisar os resultados, um ponto do seu trabalho chamou minha atenção: ' + marcaDestaque)
    p.push(
      'É fácil concluir um chamado e já voltar a atenção para o próximo. Por isso quero reservar este momento para reconhecer o que você realizou no mês. Olhe para esse resultado com orgulho: ele mostra o valor da sua contribuição para o atendimento.'
    )
    p.push('Parabéns, ' + nome + '!')
  } else if (r.posicao === 3) {
    assunto = nome + ', você está entre os três destaques do Programa de Estrelas!'
    p.push('Olá, ' + nome + '!')
    p.push(
      'Você conquistou o 3º lugar no Programa de Estrelas de ' + mesAno + empate +
        ', apurado pelos registros do Portal do Cliente!'
    )
    p.push('§NUMEROS')
    if (complemento) p.push(complemento)
    p.push(
      'Entre os seus resultados do mês, quero destacar: ' + marcaDestaque +
        ' Faço questão de mencionar porque, na rotina, uma contribuição assim passa depressa quando a equipe já está voltada para a próxima demanda.'
    )
    p.push('Receba meus parabéns pelo trabalho deste mês.')
  } else {
    assunto = nome + ', obrigado pelo seu trabalho no atendimento em ' + mes
    p.push('Olá, ' + nome + '!')
    p.push(
      'Fechamos a edição de ' + mesAno +
        ' do Programa de Estrelas, e quero agradecer pessoalmente pela sua contribuição ao atendimento neste mês.'
    )
    p.push('§NUMEROS')
    if (complemento) p.push(complemento)
    if (destaque) p.push(destaque)
    p.push(
      'Para quem abre um chamado, aquela solicitação importa. Ter alguém que se dedica a entender o que a pessoa precisa e a dar andamento à demanda faz diferença na experiência de ser atendido. Obrigado por assumir essa responsabilidade no dia a dia.'
    )
    p.push(
      'Se algum atendimento deste mês te deu orgulho ou trouxe um aprendizado, vou gostar de ouvir. Sua perspectiva ajuda a equipe a entender melhor o atendimento.'
    )
  }

  p.push('Um abraço,\n' + assinatura)

  return {
    assunto,
    paragrafos: p.filter((x) => x !== '§NUMEROS' || numeros),
    numeros,
    pendencias,
  }
}

/* Frase pronta para mês parcial (entrada, férias ou afastamento). */
export function fraseMesParcial(inicio = '[data]', fim = '[data]') {
  return 'Esses números cobrem o período em que você esteve no atendimento neste mês, de ' + inicio + ' a ' + fim + '.'
}
