'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { casaBusca, palavrasDaBusca } from '@/lib/busca'

/*
 * Filtro de empresa com busca por digitação (no lugar da lista suspensa
 * com centenas de empresas). Digite parte do nome, código ou CNPJ que
 * estiver no nome: acentos, maiúsculas e ordem das palavras não importam.
 * Setas escolhem, Enter confirma, Esc fecha. O valor é o id da empresa
 * ('' = todas), igual ao <select> que substitui.
 */

type Opcao = { id: string; nome: string }

export default function FiltroEmpresa({
  valor,
  aoMudar,
  opcoes,
  rotuloTodas = 'Todas as empresas',
  largura = 260,
}: {
  valor: string
  aoMudar: (id: string) => void
  opcoes: Opcao[]
  rotuloTodas?: string
  largura?: number
}) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [ativo, setAtivo] = useState(0)
  const caixa = useRef<HTMLDivElement | null>(null)
  const campo = useRef<HTMLInputElement | null>(null)
  const lista = useRef<HTMLUListElement | null>(null)
  const idLista = useId()

  const selecionada = useMemo(() => opcoes.find((o) => o.id === valor) || null, [opcoes, valor])

  /* "Todas" sempre primeiro; depois as que casam com o texto (máx. 200 na tela). */
  const filtradas = useMemo(() => {
    const palavras = palavrasDaBusca(texto)
    const casam = palavras.length ? opcoes.filter((o) => casaBusca(o.nome, palavras)) : opcoes

    return [{ id: '', nome: rotuloTodas }, ...casam.slice(0, 200)]
  }, [opcoes, texto, rotuloTodas])

  const total = palavrasDaBusca(texto).length ? opcoes.filter((o) => casaBusca(o.nome, palavrasDaBusca(texto))).length : opcoes.length

  useEffect(() => {
    if (!aberto) return

    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) fechar()
    }

    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  /* Mantém o item ativo visível ao navegar com as setas. */
  useEffect(() => {
    if (!aberto || !lista.current) return
    const el = lista.current.children[ativo] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [ativo, aberto])

  function abrir() {
    setTexto('')
    setAtivo(Math.max(0, filtradas.findIndex((o) => o.id === valor)))
    setAberto(true)
  }

  function fechar() {
    setAberto(false)
    setTexto('')
  }

  function escolher(id: string) {
    aoMudar(id)
    fechar()
    campo.current?.blur()
  }

  return (
    <div ref={caixa} style={{ position: 'relative', width: largura, maxWidth: '100%', minWidth: 0 }}>
      <input
        ref={campo}
        type="text"
        role="combobox"
        aria-label="Empresa"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && filtradas[ativo] ? idLista + '-' + ativo : undefined}
        autoComplete="off"
        value={aberto ? texto : selecionada ? selecionada.nome : ''}
        placeholder={aberto ? 'Digite para buscar a empresa' : rotuloTodas}
        title={selecionada ? selecionada.nome : rotuloTodas}
        onFocus={() => !aberto && abrir()}
        onClick={() => !aberto && abrir()}
        onChange={(e) => {
          setTexto(e.target.value)
          setAtivo(e.target.value.trim() ? 1 : 0)
          if (!aberto) setAberto(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!aberto) return abrir()
            setAtivo((i) => Math.min(filtradas.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAtivo((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter') {
            if (!aberto) return
            e.preventDefault()
            const o = filtradas[ativo]
            if (o) escolher(o.id)
          } else if (e.key === 'Escape') {
            if (aberto) {
              e.preventDefault()
              fechar()
            }
          } else if (e.key === 'Tab') {
            fechar()
          }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          paddingRight: valor ? 30 : 26,
          fontWeight: selecionada && !aberto ? 600 : undefined,
        }}
      />

      {valor && !aberto ? (
        <button
          type="button"
          aria-label="Limpar empresa (todas)"
          title="Mostrar todas as empresas"
          onClick={() => escolher('')}
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 0,
            background: 'transparent',
            color: 'var(--ink-muted)',
            cursor: 'pointer',
            width: 24,
            height: 24,
            borderRadius: 6,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      ) : (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--ink-muted)',
            fontSize: 11,
          }}
        >
          ▼
        </span>
      )}

      {aberto && (
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          aria-label="Empresas"
          style={{
            position: 'absolute',
            zIndex: 60,
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: 'min(520px, 92vw)',
            maxHeight: 320,
            overflowY: 'auto',
            margin: 0,
            padding: 4,
            listStyle: 'none',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
          }}
        >
          {filtradas.map((o, i) => (
            <li
              key={o.id || 'todas'}
              id={idLista + '-' + i}
              role="option"
              aria-selected={o.id === valor}
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(o.id)
              }}
              onMouseEnter={() => setAtivo(i)}
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                background: i === ativo ? 'var(--primary-tint)' : undefined,
                fontWeight: o.id === valor ? 700 : o.id === '' ? 600 : 400,
                color: o.id === '' ? 'var(--ink-muted)' : 'var(--ink)',
              }}
            >
              {o.nome}
            </li>
          ))}

          {filtradas.length === 1 && (
            <li role="presentation" style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Nenhuma empresa com “{texto.trim()}”.
            </li>
          )}

          {total > 200 && (
            <li role="presentation" style={{ padding: '6px 10px', fontSize: 11.5, color: 'var(--ink-faint)' }}>
              Mostrando 200 de {total}. Digite mais para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
