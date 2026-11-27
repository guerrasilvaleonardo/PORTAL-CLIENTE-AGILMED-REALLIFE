import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/*
 * Quem testou e o que fez com o teste (supabase/teste-de-7-dias.sql).
 *
 * POR QUE PELA ROTA E NÃO DIRETO DA TELA. A tabela modulo_testes só
 * deixa o cliente ver o teste da própria empresa — é o certo para o
 * portal, mas inútil para a equipe, que precisa ver todos. Aqui a
 * leitura é com a chave de serviço, depois de confirmar que quem
 * pergunta é da equipe interna.
 *
 * Só lê. Nada nesta rota grava.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const PODEM_VER = ['admin', 'gestor', 'atendimento']

async function verificarEquipe(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const token = authorization.replace('Bearer ', '').trim()
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const { data: perfil } = await supabaseAdmin
    .from('profiles')
    .select('perfil, ativo')
    .eq('id', user.id)
    .maybeSingle()

  const p = perfil as { perfil: string | null; ativo: boolean | null } | null
  if (!p || !PODEM_VER.includes(p.perfil || '') || p.ativo !== true) return null

  return user
}

type Linha = {
  id: string
  empresa_id: string
  modulo: string
  iniciado_em: string
  termina_em: string
  convertido_em: string | null
  chamado_id: string | null
  empresas: { razao_social: string | null; nome_fantasia: string | null; interna: boolean | null } | null
  chamados: { numero: number | null; status: string | null } | null
}

export async function GET(request: Request) {
  const user = await verificarEquipe(request)
  if (!user) {
    return NextResponse.json({ erro: 'Acesso restrito à equipe interna.' }, { status: 403 })
  }

  const COM_ANINHADOS =
    'id, empresa_id, modulo, iniciado_em, termina_em, convertido_em, chamado_id,' +
    ' empresas(razao_social, nome_fantasia, interna), chamados(numero, status)'

  let { data, error } = await supabaseAdmin
    .from('modulo_testes')
    .select(COM_ANINHADOS)
    .order('iniciado_em', { ascending: false })

  /*
   * Logo depois da migração o PostgREST pode ainda não ter recarregado
   * o mapa de chaves estrangeiras, e aí o aninhamento falha. A tela não
   * precisa morrer por isso: sem os nomes, ainda dá para ver quem
   * testou e quando.
   */
  if (error && /relationship|foreign key|schema cache/i.test(error.message || '')) {
    const simples = await supabaseAdmin
      .from('modulo_testes')
      .select('id, empresa_id, modulo, iniciado_em, termina_em, convertido_em, chamado_id')
      .order('iniciado_em', { ascending: false })

    data = simples.data as typeof data
    error = simples.error
  }

  /* O SQL do teste ainda não rodou: a tela mostra o aviso em vez de
     um erro vermelho sem explicação. */
  if (error) {
    if (/modulo_testes/.test(error.message || '')) {
      return NextResponse.json({ semTabela: true, testes: [] })
    }
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  const agora = Date.now()

  const testes = ((data as unknown as Linha[]) || []).map((t) => {
    const fim = new Date(t.termina_em).getTime()
    const emAndamento = fim > agora

    return {
      id: t.id,
      modulo: t.modulo,
      empresa:
        t.empresas?.nome_fantasia || t.empresas?.razao_social || '(empresa removida)',
      interna: Boolean(t.empresas?.interna),
      iniciadoEm: t.iniciado_em,
      terminaEm: t.termina_em,
      /* Três situações, e a do meio é a que interessa ao comercial:
         testou, acabou e não pediu nada. */
      situacao: t.convertido_em ? 'convertido' : emAndamento ? 'andamento' : 'encerrado',
      diasRestantes: emAndamento ? Math.ceil((fim - agora) / 86400000) : 0,
      convertidoEm: t.convertido_em,
      chamadoNumero: t.chamados?.numero ?? null,
      chamadoStatus: t.chamados?.status ?? null,
    }
  })

  const daClientela = testes.filter((t) => !t.interna)

  return NextResponse.json({
    testes,
    resumo: {
      total: daClientela.length,
      andamento: daClientela.filter((t) => t.situacao === 'andamento').length,
      encerrados: daClientela.filter((t) => t.situacao === 'encerrado').length,
      convertidos: daClientela.filter((t) => t.situacao === 'convertido').length,
    },
  })
}
