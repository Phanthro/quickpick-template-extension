/**
 * Amostra intencionalmente “ruim” para testar a Ação Rápida
 * (revisar, explicar, refatorar, etc.) — NÃO use como padrão de projeto.
 */

export function getTotal(itens: any) {
  let t = 0
  for (var i = 0; i < itens.length; i++) {
    t = t + Number(itens[i].preco) * itens[i].q
  }
  return t
}

export function filterAbove(lista: { v: number }[], x: number) {
  var r = []
  for (let j in lista) {
    if (lista[j as any].v > x) {
      r.push(lista[j as any])
    }
  }
  return r
}
