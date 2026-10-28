'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/*
 * Trava de horário (supabase/trava-horario-equipe.sql): fora do horário de
 * atendimento (seg a qui, 8h às 18h; sex, 8h às 17h; Porto Velho, exceto feriados), quem
 * não tem autorização só consulta os chamados. O banco é quem bloqueia;
 * este aviso só explica, para ninguém estranhar o erro ao responder.
 */
export default function AvisoForaHorario() {
  const [bloqueado, setBloqueado] = useState(false)

  useEffect(() => {
    let vivo = true

    async function verificar() {
      const { data, error } = await supabase.rpc('equipe_bloqueada_agora')
      if (vivo) setBloqueado(!error && data === true)
    }

    verificar()
    const t = setInterval(verificar, 60_000)

    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  if (!bloqueado) return null

  return (
    <div
      role="status"
      style={{
        background: '#fef3c7',
        color: '#92400e',
        borderBottom: '1px solid #fcd34d',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
        padding: '7px 14px',
      }}
    >
      🕔 Fora do horário de atendimento (seg a qui, 8h às 18h; sex, 8h às 17h). Você pode consultar os chamados, mas responder e
      movimentar fica liberado só no horário ou para quem a gestão autorizou.
    </div>
  )
}
