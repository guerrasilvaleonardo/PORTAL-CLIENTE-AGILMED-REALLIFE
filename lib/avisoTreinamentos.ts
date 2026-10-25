/*
 * Aviso diário do andamento dos treinamentos (supabase/treinamentos-aviso-diario.sql).
 *
 * Usa as MESMAS regras da tela Treinamentos (lib/treinamentos.ts) para
 * casar certificado e matrícula do EAD, para o e-mail e a tela mostrarem
 * os mesmos números.
 *
 * Entra no aviso:
 * - Pendente: certificado ainda não emitido (sem emissão, validade nem
 *   arquivo) e treinamento não concluído (inclui "sem matrícula").
 * - Concluído: chegou a 100% e ainda não foi avisado; aparece uma vez.
 * Colaborador desligado (lib/colaboradoresDesligados.ts) não entra no
 * aviso nem tem o estado gravado. Sem a tabela, ninguém é tirado.
 * Empresa sem pendente nem concluído novo não recebe e-mail.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { enderecoDoPortal, escapar, marcaDaEmpresa, montarEmail } from '@/lib/email'
import {
  etapaDoProgresso,
  progressosDosCertificados,
  ROTULO_ETAPA,
  type CertificadoComProgresso,
  type Etapa,
  type Progresso,
} from '@/lib/treinamentos'
import { lerTudo } from '@/lib/lerTudo'
import { carregarDesligados, estaDesligado } from '@/lib/colaboradoresDesligados'

const FUSO = -4 * 3600000

export type ItemAviso = {
  certificadoId: string
  colaborador: string
  funcao: string | null
  curso: string
  progresso: number
  etapa: Etapa
  presencial: boolean
  situacao: string | null
  diasSemAvanco: number | null
}

export type AvisoEmpresa = {
  empresaId: string
  empresa: string
  marca: ReturnType<typeof marcaDaEmpresa>
  pendentes: ItemAviso[]
  concluidos: ItemAviso[]
  aguardandoEmissao: number
}

type Cert = CertificadoComProgresso & {
  id: string
  empresa_id: string
  colaborador: string
  funcao: string | null
  tipo: string | null
}

export type Atualizacao = {
  certificado_id: string
  progresso: number
  mudou_em: string
  concluido_avisado_em: string | null
  empresa_id: string
  novoConcluido: boolean
}

type Estado = { certificado_id: string; progresso: number; mudou_em: string; concluido_avisado_em: string | null }

function emitido(c: Cert) {
  return Boolean(c.emissao || c.validade || c.link_certificado)
}

/* Hoje em Porto Velho, AAAA-MM-DD. */
export function hojePortoVelho(agora = new Date()) {
  return new Date(agora.getTime() + FUSO).toISOString().slice(0, 10)
}

/* Dia útil em Porto Velho: segunda a sexta e fora dos feriados cadastrados. */
export async function ehDiaUtil(db: SupabaseClient, agora = new Date()) {
  const local = new Date(agora.getTime() + FUSO)
  const dow = local.getUTCDay()
  if (dow === 0 || dow === 6) return false
  const { data, error } = await db.from('feriados').select('data').eq('data', hojePortoVelho(agora)).limit(1)
  if (error) return true
  return !(data && data.length)
}

function diasCorridos(desde: string, agora: Date) {
  return Math.floor((agora.getTime() - new Date(desde).getTime()) / 86400000)
}

/*
 * Monta os avisos de todas as empresas com a ferramenta Treinamentos.
 * Não grava nada: quem envia chama `registrarEstado` depois.
 */
export async function montarAvisos(db: SupabaseClient, agora = new Date()) {
  const { data: empresasData, error: erroEmpresas } = await db
    .from('empresas')
    .select('id, nome_fantasia, razao_social, marca, interna, modulo_treinamentos')
  if (erroEmpresas) throw erroEmpresas

  const empresas = new Map<string, any>()
  for (const e of (empresasData || []) as any[]) {
    if (e.interna) continue
    if (e.modulo_treinamentos === false) continue
    empresas.set(e.id, e)
  }

  let { data: certsData, error: erroCerts } = await lerTudo<any>(() =>
    db
      .from('certificados')
      .select(
        'id, empresa_id, colaborador, funcao, email_colaborador, curso, tipo, emissao, validade, link_certificado, created_at, progresso_origem, progresso_etapa, progresso_manual, progresso_manual_em'
      )
      .order('id')
  )
  if (erroCerts) throw erroCerts

  let { data: progData, error: erroProg } = await db
    .from('treinamentos_progresso')
    .select('email, curso, progresso, situacao, atualizado_em, inicio')
  if (erroProg) {
    const r = await db.from('treinamentos_progresso').select('email, curso, progresso, situacao, atualizado_em')
    progData = r.data as any
  }

  const { data: estadosData, error: erroEstado } = await db
    .from('treinamentos_aviso')
    .select('certificado_id, progresso, mudou_em, concluido_avisado_em')
  if (erroEstado) throw new Error('Tabela treinamentos_aviso ausente: rode supabase/treinamentos-aviso-diario.sql. ' + erroEstado.message)

  const { mapa: desligados } = await carregarDesligados(db)

  const estado = new Map<string, Estado>()
  for (const s of (estadosData || []) as Estado[]) estado.set(s.certificado_id, s)

  const certs = ((certsData || []) as Cert[]).filter((c) => empresas.has(c.empresa_id))
  const progressos = (progData || []) as Progresso[]

  /* Mesma regra da tela, por empresa (a matrícula não é dividida entre certificados). */
  const porEmpresa = new Map<string, Cert[]>()
  for (const c of certs) porEmpresa.set(c.empresa_id, [...(porEmpresa.get(c.empresa_id) || []), c])

  const avisos: AvisoEmpresa[] = []
  const atualizacoes: Atualizacao[] = []
  const agoraIso = agora.toISOString()

  for (const [empresaId, lista] of porEmpresa) {
    const e = empresas.get(empresaId)
    const mapa = progressosDosCertificados(lista, progressos)
    const pendentes: ItemAviso[] = []
    const concluidos: ItemAviso[] = []
    let aguardandoEmissao = 0

    for (const c of lista) {
      if (emitido(c)) continue

      /* O casamento com o EAD (mapa) usa todos; o desligado só sai do aviso. */
      if (estaDesligado(desligados, c)) continue

      const reg = mapa.get(c) ?? null
      const etapa = etapaDoProgresso(reg)
      const progresso = Math.round(reg?.progresso ?? 0)
      const anterior = estado.get(c.id)

      const mudou = !anterior || anterior.progresso !== progresso
      const mudouEm = mudou ? agoraIso : anterior!.mudou_em

      const item: ItemAviso = {
        certificadoId: c.id,
        colaborador: c.colaborador || 'Colaborador',
        funcao: c.funcao,
        curso: c.curso || c.tipo || 'Curso',
        progresso,
        etapa,
        presencial: reg?.origem === 'manual',
        situacao: reg?.situacao ?? null,
        diasSemAvanco: anterior && !mudou ? diasCorridos(anterior.mudou_em, agora) : null,
      }

      let concluidoAvisado = anterior?.concluido_avisado_em ?? null

      /* Primeira vez que o portal vê este certificado: o que já estava concluído não vira "novidade". */
      const novidade = etapa === 'concluido' && !!anterior && !concluidoAvisado

      if (etapa === 'concluido') {
        if (novidade) {
          concluidos.push(item)
          concluidoAvisado = agoraIso
        } else {
          concluidoAvisado = concluidoAvisado || agoraIso
          aguardandoEmissao++
        }
      } else {
        concluidoAvisado = null
        pendentes.push(item)
      }

      atualizacoes.push({
        certificado_id: c.id,
        progresso,
        mudou_em: mudouEm,
        concluido_avisado_em: concluidoAvisado,
        empresa_id: empresaId,
        novoConcluido: novidade,
      })
    }

    if (pendentes.length || concluidos.length) {
      const ordem = (a: ItemAviso, b: ItemAviso) => a.colaborador.localeCompare(b.colaborador, 'pt-BR') || a.curso.localeCompare(b.curso, 'pt-BR')
      avisos.push({
        empresaId,
        empresa: e.nome_fantasia || e.razao_social || 'Empresa',
        marca: marcaDaEmpresa(e.marca),
        pendentes: pendentes.sort(ordem),
        concluidos: concluidos.sort(ordem),
        aguardandoEmissao,
      })
    }
  }

  return { avisos, atualizacoes }
}

/*
 * Grava o último estado visto (só depois de enviar). Empresa cujo e-mail
 * não saiu não marca a conclusão como avisada, para ela aparecer no
 * próximo aviso; o percentual é gravado sempre.
 */
export async function registrarEstado(db: SupabaseClient, atualizacoes: Atualizacao[], empresasEnviadas: Set<string>) {
  const agora = new Date().toISOString()
  const linhas = atualizacoes.map((a) => ({
    certificado_id: a.certificado_id,
    progresso: a.progresso,
    mudou_em: a.mudou_em,
    concluido_avisado_em: a.novoConcluido && !empresasEnviadas.has(a.empresa_id) ? null : a.concluido_avisado_em,
    atualizado_em: agora,
  }))
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db.from('treinamentos_aviso').upsert(linhas.slice(i, i + 500), { onConflict: 'certificado_id' })
    if (error) throw error
  }
}

function barra(p: number) {
  const cor = p >= 100 ? '#15803d' : p > 0 ? '#b45309' : '#94a3b8'
  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:120px;border-collapse:collapse;display:inline-table;vertical-align:middle;"><tr>' +
    '<td style="height:6px;width:' + Math.max(0, Math.min(100, p)) + '%;background:' + cor + ';border-radius:3px;"></td>' +
    '<td style="height:6px;background:#e2e8f0;border-radius:3px;"></td></tr></table>'
  )
}

function descricao(i: ItemAviso) {
  if (i.presencial) return 'Presencial · ' + (i.situacao || ROTULO_ETAPA[i.etapa])
  if (i.etapa === 'sem_dados') return 'Ainda sem matrícula no EAD'
  if (i.etapa === 'nao_iniciado') return 'Não iniciado (0%)'
  if (i.etapa === 'concluido') return 'Concluído · 100%'
  return 'Em andamento · ' + i.progresso + '%'
}

function blocoPessoas(itens: ItemAviso[], mostrarParado: boolean) {
  const porPessoa = new Map<string, ItemAviso[]>()
  for (const i of itens) porPessoa.set(i.colaborador + '|' + (i.funcao || ''), [...(porPessoa.get(i.colaborador + '|' + (i.funcao || '')) || []), i])

  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px;">' +
    [...porPessoa.values()]
      .map((lista) => {
        const p = lista[0]
        return (
          '<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">' +
          '<strong style="color:#0f172a;">' + escapar(p.colaborador) + '</strong>' +
          (p.funcao ? ' <span style="color:#64748b;font-size:12.5px;">· ' + escapar(p.funcao) + '</span>' : '') +
          lista
            .map((i) => {
              const parado =
                mostrarParado && i.etapa !== 'sem_dados' && !i.presencial && i.diasSemAvanco !== null && i.diasSemAvanco >= 3
                  ? ' <span style="color:#b91c1c;font-size:12px;">· sem avanço há ' + i.diasSemAvanco + ' dias</span>'
                  : ''
              return (
                '<div style="margin-top:5px;font-size:13.5px;">' +
                escapar(i.curso) +
                '<br>' +
                (i.etapa === 'sem_dados' || i.presencial ? '' : barra(i.progresso) + ' ') +
                '<span style="color:#475569;font-size:12.5px;">' + escapar(descricao(i)) + '</span>' +
                parado +
                '</div>'
              )
            })
            .join('') +
          '</td></tr>'
        )
      })
      .join('') +
    '</table>'
  )
}

export function emailDoAviso(a: AvisoEmpresa) {
  const portal = enderecoDoPortal(a.marca)
  const pessoasPend = new Set(a.pendentes.map((i) => i.colaborador)).size
  const paragrafos: string[] = [
    'Situação de hoje dos treinamentos de <strong>' + escapar(a.empresa) + '</strong>.',
  ]

  if (a.pendentes.length) {
    paragrafos.push(
      '<strong>' + a.pendentes.length + '</strong> treinamento(s) em aberto, de <strong>' + pessoasPend + '</strong> colaborador(es). Para concluir, cada colaborador acessa a plataforma EAD com o próprio e-mail e finaliza o curso.',
      blocoPessoas(a.pendentes, true)
    )
  }
  if (a.concluidos.length) {
    paragrafos.push('<strong>Concluídos desde o último aviso</strong> (o certificado será emitido pela nossa equipe):', blocoPessoas(a.concluidos, false))
  }
  if (a.aguardandoEmissao) {
    paragrafos.push(a.aguardandoEmissao + ' treinamento(s) já concluído(s) aguardando a emissão do certificado.')
  }

  const assunto =
    'Andamento dos treinamentos — ' +
    (a.pendentes.length ? a.pendentes.length + ' em aberto' : '') +
    (a.pendentes.length && a.concluidos.length ? ' e ' : '') +
    (a.concluidos.length ? a.concluidos.length + ' concluído(s)' : '')

  const html = montarEmail(
    a.marca,
    'Andamento dos treinamentos',
    paragrafos,
    { rotulo: 'Ver os treinamentos', url: portal + '/treinamentos' },
    'Aviso automático às segundas e sextas, com os dados da plataforma EAD lidos às 5h (Porto Velho). Só é enviado quando há treinamento em aberto ou concluído.'
  )

  return { assunto, html }
}
