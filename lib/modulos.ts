'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Ferramentas cobradas à parte (supabase/modulos-cliente.sql). Cada
 * empresa tem uma marcação por ferramenta; sem ela, o cliente vê a
 * ferramenta com cadeado e pede a contratação por chamado. A equipe
 * interna vê tudo.
 */

export type Modulo = 'certificados' | 'treinamentos' | 'documentos'

export const MODULOS: Record<
  Modulo,
  { rotulo: string; href: string; coluna: string; resumo: string; beneficios: string[] }
> = {
  certificados: {
    rotulo: 'Certificados',
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
    href: '/documentos',
    coluna: 'modulo_documentos',
    resumo: 'PGR, PCMSO, laudos e programas da sua empresa: prazos, revisões e versões assinadas.',
    beneficios: [
      'Vencimentos e revisões programadas em um só lugar',
      'Documento assinado sempre à mão, com histórico de revisões',
      'Avisos por e-mail antes do prazo e pedido de renovação em um clique',
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
    liberados: { certificados: true, treinamentos: true, documentos: true },
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
        let liberados = { certificados: true, treinamentos: true, documentos: true }

        if (!interno && perfil?.empresa_id) {
          const { data: emp, error } = await supabase
            .from('empresas')
            .select('modulo_certificados, modulo_treinamentos, modulo_documentos')
            .eq('id', perfil.empresa_id)
            .maybeSingle()

          if (!error && emp) {
            liberados = {
              certificados: emp.modulo_certificados !== false,
              treinamentos: emp.modulo_treinamentos !== false,
              documentos: emp.modulo_documentos !== false,
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
