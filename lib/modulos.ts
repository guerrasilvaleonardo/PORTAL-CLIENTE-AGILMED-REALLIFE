'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

export type AcessoModulos = {
  carregando: boolean
  interno: boolean
  /* Ferramenta liberada para quem está vendo (equipe: sempre). */
  liberado: (m: Modulo) => boolean
}

const PERFIS_INTERNOS = ['atendimento', 'gestor', 'admin']

/*
 * Lê o perfil e as marcações da empresa. Se a migração ainda não
 * rodou (coluna inexistente), trata tudo como liberado, para não
 * bloquear ninguém por engano.
 */
export function useModulos(): AcessoModulos {
  const [estado, setEstado] = useState<{ carregando: boolean; interno: boolean; liberados: Record<Modulo, boolean> }>({
    carregando: true,
    interno: false,
    liberados: { certificados: true, treinamentos: true, documentos: true, epi: true, inspecoes: true, auditoria: true, implantacao: true },
  })

  useEffect(() => {
    let ativo = true

    async function carregar() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: perfil } = await supabase.from('profiles').select('perfil, empresa_id').eq('id', user.id).single()

        const interno = PERFIS_INTERNOS.includes(perfil?.perfil || '')
        let liberados = { certificados: true, treinamentos: true, documentos: true, epi: true, inspecoes: true, auditoria: true, implantacao: true }

        if (!interno && perfil?.empresa_id) {
          const { data: emp, error } = await supabase
            .from('empresas')
            .select('modulo_certificados, modulo_treinamentos, modulo_documentos, modulo_epi, modulo_inspecoes, modulo_auditoria, modulo_implantacao')
            .eq('id', perfil.empresa_id)
            .maybeSingle()

          if (!error && emp) {
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

        if (ativo) setEstado({ carregando: false, interno, liberados })
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

  return {
    carregando: estado.carregando,
    interno: estado.interno,
    liberado: (m) => estado.interno || estado.liberados[m],
  }
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
