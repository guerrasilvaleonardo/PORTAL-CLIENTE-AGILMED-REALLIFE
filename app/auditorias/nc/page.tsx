'use client'

import { ComModulo } from '@/components/ModuloBloqueado'
import { NaoConformidadesConteudo } from '../../inspecoes/nc/page'

/*
 * As constatações da auditoria são não conformidades e recebem o mesmo
 * tratamento do item 10.2 — causa, ação corretiva e verificação da
 * eficácia. Por isso a tela é a mesma das inspeções.
 *
 * O que muda é o que entra na lista: só o que nasceu de auditoria. São
 * processos diferentes, e misturar o extintor vencido no canteiro com o
 * requisito 9.3 da norma tira o sentido das duas listas.
 */
export default function ConstatacoesDaAuditoria() {
  return (
    <ComModulo modulo="auditoria">
      <NaoConformidadesConteudo tipo="auditoria" />
    </ComModulo>
  )
}
