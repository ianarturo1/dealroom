import { ok, text, readLocalJson } from './_lib/utils.mjs'
import { decodeIndexContent } from './_lib/investor-index.mjs'

const collator = new Intl.Collator('es', { sensitivity: 'base' })

export async function handler(){
  try{
    const data = await readLocalJson('data/investor-index.json')
    const { entries } = decodeIndexContent(data)
    const investors = entries
      .map(item => ({
        id: item.id || item.slug,
        name: item.name || '',
        email: item.email || '',
        status: item.status || ''
      }))
      .sort((a, b) => {
        const nameCompare = collator.compare(a.name || a.id, b.name || b.id)
        if (nameCompare !== 0) return nameCompare
        return collator.compare(a.id, b.id)
      })
    return ok({ investors })
  }catch(error){
    return text(500, error.message)
  }
}
