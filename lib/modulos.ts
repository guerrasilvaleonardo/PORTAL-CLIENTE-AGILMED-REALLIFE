'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { empresaAtual, perfilAtual } from '@/lib/sessaoAtual'

/*
 * Ferramentas cobradas à parte (supabase/modulos-cliente.sql). Cada
 * empresa tem uma marcação por ferramenta; sem ela, o cliente vê a
 * ferramenta com cadeado e pede a contratação por chamado. A equipe
 * interna vê tudo.
 */

export type Modulo = 'certificados' | 'treinamentos' | 'documentos' | 'epi' | 'inspecoes' | 'auditoria' | 'implantacao'

export const MODULOS: Record<
  Modulo,
  { rotulo: string; href: string; coluna: string; resumo: string; beneficios: string[]; chamada: string }
> = {
  certificados: {
    rotulo: 'Certificados',
    /* Título da vitrine: a dor do cliente, não o nome da ferramenta. */
    chamada: 'Nenhum certificado vence sem você saber',
    href: '/certificados',
    coluna: 'modulo_certificados',
    resumo: 'Validade dos treinamentos e certificados de cada colaborador, com avisos antes de vencer.',
    beneficios: [
      'Painel de vencidos, a vencer em 90 dias e em dia',
      'Certificado assinado a um clique, por colaborador',
      'Boletim semanal por e-mail com o que vence em 90, 30 e 7 dias',
    ],
  },
  treinamentos: {
    rotulo: 'Treinamentos',
    chamada: 'Saiba quem da sua equipe já está treinado, sem pedir planilha',
    href: '/treinamentos',
    coluna: 'modulo_treinamentos',
    resumo: 'Andamento dos cursos a distância (EAD) de cada colaborador, atualizado todo dia.',
    beneficios: [
      'Quem concluiu, quem está em andamento e quem não começou',
      'Cursos que mais travam, por empresa e por situação',
      'Planilha para acompanhar a turma',
    ],
  },
  documentos: {
    rotulo: 'Documentos SST',
    chamada: 'PGR, PCMSO e laudos sempre em dia e à mão',
    href: '/documentos',
    coluna: 'modulo_documentos',
    resumo: 'PGR, PCMSO, laudos e programas da sua empresa: prazos, revisões e versões assinadas.',
    beneficios: [
      'Vencimentos e revisões programadas em um só lugar',
      'Documento assinado sempre à mão, com histórico de revisões',
      'Avisos por e-mail antes do prazo e pedido de renovação em um clique',
    ],
  },
  epi: {
    rotulo: 'EPI',
    chamada: 'A ficha da NR-06 pronta, sem papel e sem caderno',
    href: '/epi',
    coluna: 'modulo_epi',
    resumo:
      'Entrega de EPI com foto e assinatura do trabalhador no celular, controle de devolução e a ficha que a fiscalização pede.',
    beneficios: [
      'Entrega registrada com foto e assinada na hora, pelo celular',
      'Ficha da NR-06 por trabalhador, pronta para imprimir',
      'Painel do que está vencido, de quem não assinou e do que voltou',
    ],
  },
  inspecoes: {
    rotulo: 'Inspeções',
    chamada: 'O que o técnico viu em campo vira ação, não papel na gaveta',
    href: '/inspecoes',
    coluna: 'modulo_inspecoes',
    resumo:
      'Checklist de inspeção aplicado no celular, não conformidade com responsável e prazo, e o registro de acidentes e quase-acidentes.',
    beneficios: [
      'Checklist seu ou da Real Life, aplicado em campo',
      'Cada item reprovado vira não conformidade com prazo',
      'Causa, ação corretiva e verificação da eficácia, como a ISO 45001 e a 9001 pedem',
    ],
  },
  /*
   * AUDITAR E IMPLANTAR SÃO DOIS PRODUTOS, e o cliente precisa saber em
   * dois segundos qual é o dele. A regra que separa os textos: quem já
   * tem o sistema montado AUDITA; quem não tem nada IMPLANTA. Por isso
   * as duas chamadas começam declarando para quem servem, em vez de
   * vender o benefício — benefício do produto errado não ajuda ninguém.
   */
  auditoria: {
    rotulo: 'Auditar o sistema',
    /* As duas normas pelo nome, não "o sistema" nem "a norma". Quem
       está pensando em certificação procura por ISO 9001 e ISO 45001;
       "sistema de gestão" é como nós chamamos, não como ele pergunta. */
    chamada: 'Já tem ISO 9001 ou ISO 45001? Veja se passa antes do auditor externo',
    href: '/auditorias',
    coluna: 'modulo_auditoria',
    resumo:
      'Para quem JÁ TEM o sistema de gestão funcionando. Percorre a ISO 9001 e a ISO 45001 '
      + 'requisito a requisito, diz o que pedir para ver em cada um, e o que não atende vira '
      + 'constatação com prazo e dono.',
    beneficios: [
      'Checklist da ISO 45001 e da ISO 9001, requisito por requisito',
      'Programa anual, plano, reuniões e relatório, como a ISO 19011 pede',
      'Cada achado vira não conformidade maior ou menor, com prazo e dono',
      'Se você ainda não tem o sistema montado, comece por Implantar o sistema',
    ],
  },
  /* A auditoria verifica o sistema; esta ferramenta constrói. É o
   * cliente que ainda não tem nada montado — que é a maioria. */
  implantacao: {
    rotulo: 'Implantar o sistema',
    /* A pergunta que separa os dois módulos continua na frente — é ela
       que diz ao cliente qual dos dois é o dele —, agora com as normas
       pelo nome. */
    chamada: 'Não tem ISO 9001 nem ISO 45001? Monte do zero, etapa por etapa',
    href: '/implantacao',
    coluna: 'modulo_implantacao',
    resumo:
      'Para quem NÃO TEM o sistema ainda. Trilha guiada da ISO 9001 e da ISO 45001 pela empresa '
      + 'inteira, área por área: cada atividade traz a aula, os passos, o modelo para baixar e a '
      + 'conferência da nossa equipe.',
    beneficios: [
      'Cronograma em 16 etapas, do primeiro documento ao certificado',
      'Modelo pronto para baixar e preencher, com os passos escritos',
      'Nada avança sem a nossa aprovação — e a etapa seguinte só abre quando a anterior fecha',
      'No fim, a auditoria interna acontece aqui mesmo, no outro módulo',
    ],
  },
}

/*
 * AS DUAS QUE TÊM TESTE DE 7 DIAS (supabase/teste-de-7-dias.sql).
 *
 * São as únicas que se demonstram sozinhas em uma semana, com os dados
 * do próprio cliente. As outras cinco só mostram valor com o acervo
 * dele já carregado — teste em tela vazia vende contra nós — e
 * Implantar e Auditar ainda consomem a nossa equipe a cada etapa.
 */
export const MODULOS_COM_TESTE: Modulo[] = ['epi', 'inspecoes']

export const DIAS_DE_TESTE = 7

export type EstadoTeste = 'nenhum' | 'andamento' | 'encerrado'

export type Teste = {
  estado: EstadoTeste
  terminaEm: Date | null
  /* Dias cheios que faltam. 0 = termina hoje. */
  diasRestantes: number
  convertido: boolean
}

export type AcessoModulos = {
  carregando: boolean
  interno: boolean
  /*
   * VER e GRAVAR deixaram de ser a mesma coisa.
   *
   * Quem testou e não contratou continua VENDO o que registrou — ficha
   * da NR-06, relatório de inspeção — e só não grava mais. Por isso
   * `liberado` (a tela abre, o cadeado some) e `podeGravar` (os botões
   * de registrar funcionam) são duas perguntas diferentes.
   */
  liberado: (m: Modulo) => boolean
  podeGravar: (m: Modulo) => boolean
  /* Só contrato, sem contar teste. */
  contratado: (m: Modulo) => boolean
  teste: (m: Modulo) => Teste
}

const SEM_TESTE: Teste = { estado: 'nenhum', terminaEm: null, diasRestantes: 0, convertido: false }

/* Dias cheios daqui até lá, nunca negativo. */
function diasAte(fim: Date): number {
  const ms = fim.getTime() - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000)
}

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

/*
 * Lê o perfil e as marcações da empresa. Se a migração ainda não
 * rodou (coluna inexistente), trata tudo como liberado, para não
 * bloquear ninguém por engano.
 */
export function useModulos(): AcessoModulos {
  const [estado, setEstado] = useState<{
    carregando: boolean
    interno: boolean
    liberados: Record<Modulo, boolean>
    testes: Partial<Record<Modulo, Teste>>
  }>({
    carregando: true,
    interno: false,
    liberados: { certificados: true, treinamentos: true, documentos: true, epi: true, inspecoes: true, auditoria: true, implantacao: true },
    testes: {},
  })

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        /*
         * Perfil e empresa vêm de lib/sessaoAtual: o cabeçalho já pediu
         * os dois nesta carga de página, e antes disto cada componente
         * repetia a mesma pergunta ao banco por conta própria.
         */
        const perfil = await perfilAtual()

        if (!perfil) return

        const interno = PERFIS_INTERNOS.includes(perfil.perfil || '')
        let liberados = { certificados: true, treinamentos: true, documentos: true, epi: true, inspecoes: true, auditoria: true, implantacao: true }

        if (!interno && perfil.empresa_id) {
          const emp = await empresaAtual()

          if (emp) {
            liberados = {
              certificados: emp.modulo_certificados !== false,
              treinamentos: emp.modulo_treinamentos !== false,
              documentos: emp.modulo_documentos !== false,
              epi: emp.modulo_epi !== false,
              inspecoes: emp.modulo_inspecoes !== false,
              auditoria: emp.modulo_auditoria !== false,
              implantacao: emp.modulo_implantacao !== false,
            }
          }
        }

        /*
         * Os testes da empresa. Se a tabela ainda não existe (o SQL não
         * rodou), o portal segue como era antes: sem teste nenhum,
         * nenhuma tela quebra.
         */
        let testes: Partial<Record<Modulo, Teste>> = {}

        if (perfil?.empresa_id) {
          const { data: linhas, error: erroTeste } = await supabase
            .from('modulo_testes')
            .select('modulo, termina_em, convertido_em')
            .eq('empresa_id', perfil.empresa_id)

          if (!erroTeste && linhas) {
            for (const l of linhas as { modulo: string; termina_em: string; convertido_em: string | null }[]) {
              const fim = new Date(l.termina_em)
              const emAndamento = fim.getTime() > Date.now()
              testes[l.modulo as Modulo] = {
                estado: emAndamento ? 'andamento' : 'encerrado',
                terminaEm: fim,
                diasRestantes: emAndamento ? diasAte(fim) : 0,
                convertido: Boolean(l.convertido_em),
              }
            }
          }
        }

        if (ativo) setEstado({ carregando: false, interno, liberados, testes })
      } catch (e) {
        console.error('Não foi possível ler as ferramentas contratadas:', e)
        if (ativo) setEstado((a) => ({ ...a, carregando: false }))
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  const teste = (m: Modulo): Teste => estado.testes[m] || SEM_TESTE

  return {
    carregando: estado.carregando,
    interno: estado.interno,
    contratado: (m) => estado.interno || estado.liberados[m],
    /* Ver: contratou, ou testou um dia — o registro dele não vira refém. */
    liberado: (m) => estado.interno || estado.liberados[m] || teste(m).estado !== 'nenhum',
    /* Gravar: contratou, ou está dentro dos 7 dias. */
    podeGravar: (m) => estado.interno || estado.liberados[m] || teste(m).estado === 'andamento',
    teste,
  }
}

/*
 * Liga o teste. O banco é quem decide: recusa ferramenta sem teste,
 * empresa que já contratou e empresa que já usou o teste uma vez.
 */
export async function iniciarTeste(m: Modulo): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await supabase.rpc('iniciar_teste_modulo', { p_modulo: m })
  if (!error) return { ok: true }

  /* Função ainda não criada: o SQL não rodou. */
  if (/iniciar_teste_modulo|does not exist|42883/.test(error.message || '')) {
    return { ok: false, erro: 'O teste ainda não está disponível. Fale com a nossa equipe.' }
  }
  return { ok: false, erro: error.message }
}

/* Marca que o teste virou pedido, para o portal parar de insistir. */
export async function testeVirouChamado(m: Modulo, chamadoId: string) {
  await supabase.rpc('teste_virou_chamado', { p_modulo: m, p_chamado: chamadoId }).then(
    () => undefined,
    () => undefined,
  )
}

/* Link do chamado de contratação depois do teste, com o uso dele dentro. */
export function linkContratacaoAposTeste(m: Modulo, resumoDoUso: string) {
  const info = MODULOS[m]
  const q = new URLSearchParams({
    categoria: 'Atendimento administrativo',
    assunto: 'Contratação: ' + info.rotulo,
    descricao:
      'Testamos a ferramenta ' +
      info.rotulo +
      ' por ' +
      DIAS_DE_TESTE +
      ' dias no portal e queremos contratar.\n\n' +
      'O que registramos no teste:\n' +
      resumoDoUso +
      '\n\nQuantidade aproximada de colaboradores: \nMelhor contato para a proposta: ',
  })
  return '/chamados/novo?' + q.toString()
}

/* Link do chamado de contratação, já preenchido. */
export function linkContratacao(m: Modulo) {
  const info = MODULOS[m]
  const q = new URLSearchParams({
    categoria: 'Atendimento administrativo',
    assunto: 'Contratação: ' + info.rotulo,
    descricao:
      'Gostaríamos de contratar a ferramenta ' +
      info.rotulo +
      ' no portal.\n\nQuantidade aproximada de colaboradores/documentos: \nMelhor contato para a proposta: ',
  })
  return '/chamados/novo?' + q.toString()
}
