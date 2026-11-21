/*
 * Fila local do apontamento de campo — o que fazer quando não há sinal.
 *
 * O PROBLEMA REAL. A visita começa no portão, onde o celular pega. O
 * problema está no fundo do galpão, onde não pega. Até aqui, apontar
 * ali dava erro e o trabalho se perdia — e a pessoa aprendia a não
 * apontar onde mais precisa.
 *
 * POR QUE INDEXEDDB E NÃO localStorage. A foto é o que mais importa
 * guardar, e localStorage só aceita texto: a foto teria de virar
 * base64, ocupando um terço a mais num cofre que o navegador limita a
 * poucos megabytes. O IndexedDB guarda o Blob como está.
 *
 * O QUE ESTA FILA NÃO RESOLVE, e é honesto dizer: começar uma visita
 * sem sinal. A visita precisa existir no servidor para os apontamentos
 * terem onde se pendurar, e inventar um número local traria o problema
 * de juntar os dois depois. Quem sai do escritório abre a visita com
 * sinal; o que acontece lá dentro é que fica guardado.
 *
 * A REGRA MAIS IMPORTANTE ESTÁ NA TELA, NÃO AQUI: a visita não encerra
 * com fila pendente. Emitir um relatório com código enquanto três
 * apontamentos ainda estão no aparelho produziria um documento que
 * afirma menos do que foi visto — e com número de série, o que é pior
 * do que não ter documento.
 */

const BANCO = 'realife-campo'
const LOJA = 'apontamentos'
const VERSAO = 1

export type ApontamentoPendente = {
  id: string
  visitaId: string
  empresaId: string
  criadoEm: number
  /* O que vai para a tabela, menos as fotos. */
  dados: Record<string, unknown>
  /* As fotos ainda no aparelho, já reduzidas. */
  fotos: Blob[]
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falhou) => {
    const pedido = indexedDB.open(BANCO, VERSAO)
    pedido.onupgradeneeded = () => {
      const bd = pedido.result
      if (!bd.objectStoreNames.contains(LOJA)) {
        const loja = bd.createObjectStore(LOJA, { keyPath: 'id' })
        loja.createIndex('visita', 'visitaId')
      }
    }
    pedido.onsuccess = () => ok(pedido.result)
    pedido.onerror = () => falhou(pedido.error)
  })
}

/* Navegador sem IndexedDB (janela anônima antiga, por exemplo): a tela
   segue funcionando com sinal, e sem ele avisa em vez de fingir. */
export const temFila = () => typeof indexedDB !== 'undefined'

export async function guardar(item: ApontamentoPendente) {
  const bd = await abrir()
  return new Promise<void>((ok, falhou) => {
    const t = bd.transaction(LOJA, 'readwrite')
    t.objectStore(LOJA).put(item)
    t.oncomplete = () => ok()
    t.onerror = () => falhou(t.error)
  })
}

export async function listar(visitaId?: string): Promise<ApontamentoPendente[]> {
  const bd = await abrir()
  return new Promise((ok, falhou) => {
    const t = bd.transaction(LOJA, 'readonly')
    const pedido = t.objectStore(LOJA).getAll()
    pedido.onsuccess = () => {
      const todos = (pedido.result || []) as ApontamentoPendente[]
      ok(visitaId ? todos.filter((x) => x.visitaId === visitaId) : todos)
    }
    pedido.onerror = () => falhou(pedido.error)
  })
}

export async function remover(id: string) {
  const bd = await abrir()
  return new Promise<void>((ok, falhou) => {
    const t = bd.transaction(LOJA, 'readwrite')
    t.objectStore(LOJA).delete(id)
    t.oncomplete = () => ok()
    t.onerror = () => falhou(t.error)
  })
}

/*
 * Sobe o que estava guardado.
 *
 * O ITEM SÓ SAI DA FILA DEPOIS DE O BANCO ACEITAR. Se a foto subir e a
 * linha falhar, o item continua na fila e tenta de novo — a foto
 * repetida no balde custa alguns quilobytes; o apontamento perdido
 * custa a visita.
 */
export async function sincronizar(
  enviarFoto: (foto: Blob) => Promise<string>,
  gravar: (dados: Record<string, unknown>) => Promise<void>
) {
  const pendentes = await listar()
  const resultado = { enviados: 0, falharam: 0 }

  for (const item of pendentes) {
    try {
      const caminhos: string[] = []
      for (const foto of item.fotos) {
        caminhos.push(await enviarFoto(foto))
      }
      await gravar({ ...item.dados, fotos: caminhos, foto_path: caminhos[0] || null })
      await remover(item.id)
      resultado.enviados += 1
    } catch (e) {
      console.error('apontamento ainda sem sinal', e)
      resultado.falharam += 1
    }
  }

  return resultado
}
