import { supabaseAdmin } from '@/lib/supabaseAdmin'

/*
 * Pessoas ativas que atendem uma empresa: as que estão com ela como
 * empresa ativa e as que a têm na lista de empresas
 * (supabase/usuarios-varias-empresas.sql). Usado pelos e-mails, para que
 * quem cuida de vários CNPJs receba os avisos de todos, e não só da
 * empresa que estava aberta no portal. Sem a tabela, vale só a empresa
 * ativa (como antes).
 */
export async function pessoasDaEmpresa(empresaId: string): Promise<{ id: string; email: string | null }[]> {
  const ids = new Set<string>()

  const { data: vinculos, error } = await supabaseAdmin
    .from('usuario_empresas')
    .select('usuario_id')
    .eq('empresa_id', empresaId)

  if (!error) {
    for (const v of (vinculos || []) as { usuario_id: string }[]) ids.add(v.usuario_id)
  }

  const { data: ativos } = await supabaseAdmin
    .from('profiles')
    .select('id, email, ativo')
    .eq('empresa_id', empresaId)
    .eq('ativo', true)

  const pessoas = new Map<string, { id: string; email: string | null }>()
  for (const p of (ativos || []) as any[]) pessoas.set(p.id, { id: p.id, email: p.email })

  const faltam = [...ids].filter((id) => !pessoas.has(id))
  if (faltam.length) {
    const { data: outros } = await supabaseAdmin.from('profiles').select('id, email, ativo').in('id', faltam).eq('ativo', true)
    for (const p of (outros || []) as any[]) pessoas.set(p.id, { id: p.id, email: p.email })
  }

  return [...pessoas.values()]
}
