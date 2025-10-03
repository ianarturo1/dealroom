import { ok, text, readLocalJson } from './_lib/utils.mjs'
import { decodeIndexContent } from './_lib/investor-index.mjs'

const collator = new Intl.Collator('es', { sensitivity: 'base' })

export default async function handler(event, context){
  try{
    const data = await readLocalJson('data/investor-index.json')
    const { entries } = decodeIndexContent(data)
    const investors = entries
      .map(item => ({
        slug: item.slug,
        name: item.name || '',
        email: item.email || '',
        status: item.status || ''
      }))
      .sort((a, b) => {
        const nameCompare = collator.compare(a.name || a.slug, b.name || b.slug)
        if (nameCompare !== 0) return nameCompare
        return collator.compare(a.slug, b.slug)
      })
    return ok({ investors })
  }catch(error){
    return text(500, error.message)
  }
}
