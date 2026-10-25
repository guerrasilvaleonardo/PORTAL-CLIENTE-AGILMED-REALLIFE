/*
 * Histórico de certificados (certificado substituído por um mais novo).
 *
 * O portal guarda certificados antigos como histórico: quando o
 * colaborador renova um treinamento, o certificado anterior continua
 * cadastrado (com o link), mas não pode aparecer como "Vencido", somar
 * nos cartões de vencimento nem entrar no Boletim de Antecedência.
 *
 * Não há coluna no banco para isso: a regra é calculada aqui, no código,
 * sempre do mesmo jeito em todas as telas e e-mails.
 *
 * Regra:
 *   Um certificado é HISTÓRICO quando existe outro certificado da MESMA
 *   pessoa (mesma empresa + mesmo nome, sem acento/maiúsculas/espaços
 *   extras) e do MESMO curso (chaveCurso) com data de emissão
 *   estritamente mais nova. Se algum dos dois não tiver emissão, compara
 *   pela validade. Sem data comparável, nenhum substitui o outro. Datas
 *   iguais (empate) também não substituem.
 *
 * Mesmo curso (chaveCurso):
 *   - Com NR (no curso ou, se não houver, no tipo): "NR" + 2 dígitos, mais
 *     o que separa cursos dentro da NR: NR-10 Básico x SEP; NR-33/35
 *     Supervisor e Resgate; NR-20 por nível; NR-11 por equipamento;
 *     NR-12 por máquina; NR-18 por andaime/plataforma/PEMT. NR-05 e
 *     NR-06 são um curso só. Nas demais NRs (e na 11/12/18 sem palavra
 *     conhecida) entra também o nome do curso limpo.
 *   - Sem NR: o tipo, quando não é "Outro"; senão o nome do curso sem
 *     ano, versão, "reciclagem", "atualização", pontuação e números.
 *
 * Escolha conservadora:
 *   Na dúvida, dois cursos ficam com chaves DIFERENTES. Juntar errado
 *   esconderia um vencimento verdadeiro (ex.: NR-10 Básico vencido
 *   "coberto" por um NR-10 SEP novo). Separar demais só faz um
 *   certificado antigo continuar aparecendo como vencido, que é o
 *   comportamento de antes desta regra.
 */

export type CertificadoParaHistorico = {
  id: string
  empresa_id: string
  colaborador: string | null
  tipo: string | null
  curso: string | null
  emissao: string | null
  validade: string | null
}

/*
 * Maiúsculas, sem acento e com espaços simples. Também é a chave do nome
 * em colaboradores desligados (lib/colaboradoresDesligados.ts e a função
 * nome_colaborador_chave em supabase/colaboradores-desligados.sql).
 */
export function normalizarTexto(texto: string | null | undefined) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/* Empresa + colaborador normalizado. Sem nome, não há como agrupar. */
export function chavePessoa(c: Pick<CertificadoParaHistorico, 'empresa_id' | 'colaborador'>) {
  const nome = normalizarTexto(c.colaborador)

  if (!c.empresa_id || !nome) return null

  return c.empresa_id + '|' + nome
}

/* "NR 35", "NR-35", "NR |35", "NR_06", "NR.10" -> "35", "06"... */
const RE_NR = /(?<![A-Z])NR[\s|\-_.]*(\d{1,2})(?!\d)/

function nrDoTexto(texto: string) {
  const achado = texto.match(RE_NR)

  return achado ? achado[1].padStart(2, '0') : null
}

/* Palavras que mudam o curso dentro de uma NR (equipamento/máquina). */
const EQUIPAMENTOS_NR11: [string, RegExp][] = [
  ['EMPILHADEIRA', /\bEMPILHADEIRAS?\b/],
  ['PONTE ROLANTE', /\bPONTES? ROLANTES?\b/],
  ['MUNCK', /\bMUNCK\b/],
  ['GUINDAUTO', /\bGUINDAUTOS?\b/],
  ['GUINDASTE', /\bGUINDASTES?\b/],
  ['PALETEIRA', /\bPALETEIRAS?\b/],
  ['TRANSPALETE', /\bTRANSPALETE(IRA)?S?\b/],
  ['PORTICO', /\bPORTICOS?\b/],
  ['TALHA', /\bTALHAS?\b/],
  ['GRUA', /\bGRUAS?\b/],
  ['RIGGER', /\bRIGGER\b/],
  ['SINALEIRO', /\bSINALEIROS?\b/],
]

const MAQUINAS_NR12: [string, RegExp][] = [
  ['MOTOSSERRA', /\bMOTO ?SS?ERRAS?\b/],
  ['ROCADEIRA', /\bROCADEIRAS?\b/],
  ['RETROESCAVADEIRA', /\bRETRO ?ESCAVADEIRAS?\b/],
  ['ESCAVADEIRA', /\bESCAVADEIRAS?\b/],
  ['MINICARREGADEIRA', /\bMINI ?CARREGADEIRAS?\b/],
  ['PA CARREGADEIRA', /\bPA CARREGADEIRAS?\b/],
  ['TRATOR', /\bTRATOR(ES)?\b/],
  ['MOTONIVELADORA', /\bMOTONIVELADORAS?\b/],
  ['ROLO', /\bROLOS?\b/],
  ['TORNO', /\bTORNOS?\b/],
  ['PRENSA', /\bPRENSAS?\b/],
  ['SERRA', /\bSERRAS?\b/],
  ['ESMERILHADEIRA', /\bESMERILHADEIRAS?\b/],
  ['BETONEIRA', /\bBETONEIRAS?\b/],
  ['PERFURATRIZ', /\bPERFURATRIZ(ES)?\b/],
  ['GUINCHO', /\bGUINCHOS?\b/],
  ['COLHEDORA', /\bCOLHEDORAS?\b/],
  ['CAMINHAO', /\bCAMINHO(ES)?\b|\bCAMINHAO\b/],
]

const ATIVIDADES_NR18: [string, RegExp][] = [
  ['ANDAIME', /\bANDAIMES?\b/],
  ['PEMT', /\bPEMT\b/],
  ['PLATAFORMA', /\bPLATAFORMAS?\b/],
]

/* Níveis da NR-20 (ordem importa: "AVANCADO II" antes de "AVANCADO I"). */
const NIVEIS_NR20: [string, RegExp][] = [
  ['AVANCADO II', /\bAVANCADO (II|2)\b/],
  ['AVANCADO I', /\bAVANCADO (I|1)\b/],
  ['AVANCADO', /\bAVANCADO\b/],
  ['INTERMEDIARIO', /\bINTERMEDIARIO\b/],
  ['INICIACAO', /\bINICIACAO\b/],
  ['BASICO', /\bBASICO\b/],
  ['ESPECIFICO', /\bESPECIFICO\b/],
  ['INTEGRACAO', /\bINTEGRACAO\b/],
]

function achados(texto: string, lista: [string, RegExp][]) {
  return lista.filter(([, re]) => re.test(texto)).map(([nome]) => nome)
}

/*
 * Texto do curso sem o que muda de uma turma para outra: ano, versão,
 * "reciclagem", "atualização", pontuação e números. "DIREÇÃO DEFENSIVA
 * - 2023" e "Direção Defensiva" ficam iguais.
 *
 * Exceção conservadora: número logo depois de NIVEL, MODULO, ETAPA,
 * FASE, PARTE, CLASSE, CATEGORIA ou GRAU é mantido ("NIVEL 1" e
 * "NIVEL 2" continuam cursos diferentes).
 */
function textoLimpo(texto: string) {
  return normalizarTexto(texto)
    .replace(RE_NR, ' ')
    /* "NIVEL 2" -> "NIVELNC": o número vira letras para sobreviver à limpeza. */
    .replace(
      /\b(NIVEL|MODULO|MOD|ETAPA|FASE|PARTE|CLASSE|CATEGORIA|GRAU)[\s.:-]*(\d{1,2})\b/g,
      (_: string, palavra: string, numero: string) =>
        ' ' + palavra + 'N' + numero.replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)]) + ' '
    )
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\b(RECICLAGEM|RECICLAGENS|ATUALIZACAO|ATUALIZACOES|VERSAO|REVISAO|REV)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/*
 * Chave do curso. Duas linhas com a mesma chave são consideradas o
 * mesmo treinamento (uma renova a outra). Devolve null quando não dá
 * para identificar o curso: nesse caso o certificado nunca vira
 * histórico.
 */
export function chaveCurso(c: Pick<CertificadoParaHistorico, 'tipo' | 'curso'>) {
  const curso = normalizarTexto(c.curso)
  const tipo = normalizarTexto(c.tipo)

  const nr = nrDoTexto(curso) || nrDoTexto(tipo)

  if (nr) {
    const base = 'NR' + nr

    if (nr === '10') {
      const sep = /\bSEP\b|SISTEMA ELETRICO DE POTENCIA|\bCOMPLEMENTAR\b/.test(curso)

      return base + '|' + (sep ? 'SEP' : 'BASICO')
    }

    if (nr === '33' || nr === '35') {
      /* Supervisor e resgate são cursos próprios dentro da mesma NR. */
      const extras = [
        /\bSUPERVISOR(ES)?\b/.test(curso) ? 'SUPERVISOR' : '',
        /\bRESGATES?\b/.test(curso) ? 'RESGATE' : '',
      ].filter(Boolean)

      return extras.length ? base + '|' + extras.join('+') : base
    }

    if (nr === '20') {
      const nivel = achados(curso, NIVEIS_NR20)[0]

      return nivel ? base + '|' + nivel : base
    }

    /* NR-05 (CIPA) e NR-06 (EPI): um curso só. */
    if (nr === '05' || nr === '06') return base

    /* NR-11, NR-12 e NR-18 dependem do equipamento ou da atividade. */
    const listas: Record<string, [string, RegExp][]> = {
      '11': EQUIPAMENTOS_NR11,
      '12': MAQUINAS_NR12,
      '18': ATIVIDADES_NR18,
    }

    if (listas[nr]) {
      const itens = achados(curso, listas[nr])

      if (itens.length) return base + '|' + itens.sort().join('+')
    }

    /*
     * Demais NRs (13, 23, 31, 34...) e NR-11/12/18 sem palavra
     * conhecida: soma o texto limpo do curso, para cursos de nomes
     * diferentes dentro da mesma NR não se juntarem.
     */
    const resto = curso ? textoLimpo(curso) : ''

    return resto ? base + '|' + resto : base
  }

  /* Sem NR: o tipo, quando é um tipo de verdade; senão, o nome do curso. */
  if (tipo && tipo !== 'OUTRO') {
    const t = textoLimpo(tipo)

    return t ? 'T|' + t : null
  }

  const resto = textoLimpo(curso)

  return resto ? 'C|' + resto : null
}

/*
 * Compara a data de dois certificados: emissão quando os dois têm;
 * senão validade quando os dois têm. Devolve > 0 se `a` é mais novo,
 * < 0 se mais antigo, 0 em empate e null quando não dá para comparar.
 */
function compararDatas(a: CertificadoParaHistorico, b: CertificadoParaHistorico) {
  if (a.emissao && b.emissao) return a.emissao.localeCompare(b.emissao)
  if (a.validade && b.validade) return a.validade.localeCompare(b.validade)

  return null
}

/*
 * Para cada certificado substituído, o certificado que o substituiu
 * (o mais novo logo depois dele). Quem não está no mapa é atual.
 */
export function substitutosHistorico<T extends CertificadoParaHistorico>(lista: T[]): Map<string, T> {
  const grupos = new Map<string, T[]>()

  for (const c of lista) {
    const pessoa = chavePessoa(c)
    const curso = chaveCurso(c)

    if (!pessoa || !curso) continue

    const chave = pessoa + '#' + curso
    const g = grupos.get(chave)

    if (g) g.push(c)
    else grupos.set(chave, [c])
  }

  const resultado = new Map<string, T>()

  for (const g of grupos.values()) {
    if (g.length < 2) continue

    for (const c of g) {
      let substituto: T | null = null

      for (const outro of g) {
        if (outro === c) continue

        const cmp = compararDatas(outro, c)

        if (cmp === null || cmp <= 0) continue

        /* Entre os mais novos, fica o mais próximo (a renovação seguinte). */
        if (!substituto) {
          substituto = outro
          continue
        }

        const entre = compararDatas(outro, substituto)

        if (entre !== null && entre < 0) substituto = outro
      }

      if (substituto) resultado.set(c.id, substituto)
    }
  }

  return resultado
}

/* Ids dos certificados substituídos (histórico). */
export function idsHistorico(lista: CertificadoParaHistorico[]): Set<string> {
  return new Set(substitutosHistorico(lista).keys())
}
