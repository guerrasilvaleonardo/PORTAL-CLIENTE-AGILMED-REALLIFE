'use client'

import { supabase } from '@/lib/supabase'

/*
 * QUEM SOU EU, DE QUE EMPRESA, COM QUE FERRAMENTAS — perguntado uma vez
 * por carga de página.
 *
 * O PROBLEMA QUE ISTO RESOLVE. Medido na rede em 26/11/2026, numa única
 * carga do portal:
 *
 *   profiles?select=perfil,empresa_id   2x  (cabeçalho e useModulos)
 *   profiles?select=empresa_id          1x  (obterMarcaDaEmpresa)
 *   empresas?select=marca               2x
 *   auth.getUser()                      3x
 *
 * Cada componente perguntava a mesma coisa ao banco por conta própria,
 * e o cliente pagava a espera três vezes.
 *
 * COMO FUNCIONA. Guardamos a PROMESSA, não o resultado: quem chegar
 * enquanto a consulta está no ar entra de carona nela, em vez de abrir
 * outra. Quem chegar depois recebe o valor já resolvido.
 *
 * POR QUE É SEGURO GUARDAR. O cache vive o que a página viver. Tudo o
 * que muda a resposta — entrar, sair, trocar de empresa — faz recarga
 * completa (`window.location.href`), e a recarga apaga tudo isto. Não
 * existe o caso de mostrar os módulos da empresa errada por cache
 * velho. Se um dia a troca de empresa deixar de recarregar a página,
 * chame `limparSessaoAtual()` nela.
 */

type Usuario = { id: string } | null

type Perfil = { perfil: string | null; empresa_id: string | null } | null

/* Marca e ferramentas contratadas, de uma vez: são duas telas
   perguntando a mesma linha da mesma tabela. */
export type EmpresaDaSessao = {
  marca: string | null
  modulo_certificados: boolean | null
  modulo_treinamentos: boolean | null
  modulo_documentos: boolean | null
  modulo_epi: boolean | null
  modulo_inspecoes: boolean | null
  modulo_auditoria: boolean | null
  modulo_implantacao: boolean | null
} | null

const COLUNAS_EMPRESA =
  'marca, modulo_certificados, modulo_treinamentos, modulo_documentos,' +
  ' modulo_epi, modulo_inspecoes, modulo_auditoria, modulo_implantacao'

let promessaUsuario: Promise<Usuario> | null = null
let promessaPerfil: Promise<Perfil> | null = null
let promessaEmpresa: Promise<EmpresaDaSessao> | null = null

/* Quando as colunas das ferramentas ainda não existem no banco, a
   consulta cai para só a marca — e a tela não morre por isso. */
let semColunasDeModulo = false

export function limparSessaoAtual() {
  promessaUsuario = null
  promessaPerfil = null
  promessaEmpresa = null
}

/*
 * O cabeçalho já pede o usuário por conta própria, com limite de tempo
 * e redirecionamento para o login. Em vez de pedir de novo aqui, ele
 * entrega o que já tem.
 */
export function semearUsuario(user: { id: string } | null) {
  if (user) promessaUsuario = Promise.resolve({ id: user.id })
}

export function usuarioAtual(): Promise<Usuario> {
  if (!promessaUsuario) {
    promessaUsuario = supabase.auth
      .getUser()
      .then((r) => (r.data.user ? { id: r.data.user.id } : null))
      .catch(() => null)
  }
  return promessaUsuario
}

export function perfilAtual(): Promise<Perfil> {
  if (!promessaPerfil) {
    promessaPerfil = (async () => {
      const user = await usuarioAtual()
      if (!user) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('perfil, empresa_id')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Erro ao ler o perfil da sessão:', error)
        return null
      }
      return (data as Perfil) || null
    })()
  }
  return promessaPerfil
}

export function empresaAtual(): Promise<EmpresaDaSessao> {
  if (!promessaEmpresa) {
    promessaEmpresa = (async () => {
      const perfil = await perfilAtual()
      /* Equipe interna não tem empresa: nem vale a viagem. */
      if (!perfil?.empresa_id) return null

      const colunas = semColunasDeModulo ? 'marca' : COLUNAS_EMPRESA

      const { data, error } = await supabase
        .from('empresas')
        .select(colunas)
        .eq('id', perfil.empresa_id)
        .maybeSingle()

      if (error) {
        /* Coluna de ferramenta ainda não criada (42703): tenta de novo
           só com a marca, para o menu não sumir por causa disso. */
        if (!semColunasDeModulo && /modulo_|42703/.test(error.message || '')) {
          semColunasDeModulo = true
          promessaEmpresa = null
          return empresaAtual()
        }
        console.error('Erro ao ler a empresa da sessão:', error)
        return null
      }

      return (data as EmpresaDaSessao) || null
    })()
  }
  return promessaEmpresa
}
