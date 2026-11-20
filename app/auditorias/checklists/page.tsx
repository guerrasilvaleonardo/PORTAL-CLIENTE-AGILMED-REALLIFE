'use client'

import { ComModulo } from '@/components/ModuloBloqueado'
import { ModelosDeInspecaoConteudo } from '../../inspecoes/modelos/page'

/*
 * Os checklists de auditoria ficam aqui, não em Inspeções.
 *
 * A tela é a mesma — escrever pergunta e ordenar requisito é o mesmo
 * trabalho nos dois casos — mas a lista é separada por tipo. Checklist
 * de campo e checklist de norma são dois ofícios diferentes, e o ISO
 * 45001 aparecendo na lista do técnico de campo é ruído para ele e
 * confusão para quem audita.
 */
export default function ChecklistsDeAuditoria() {
  return (
    <ComModulo modulo="auditoria">
      <ModelosDeInspecaoConteudo tipo="auditoria" />
    </ComModulo>
  )
}
