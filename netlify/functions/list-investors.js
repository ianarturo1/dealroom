import { ok, text, readLocalJson } from './_lib/utils.mjs'

const collator = new Intl.Collator('es', { sensitivity: 'base' })

export async function handler(){
  try{
    const data = await readLocalJson('data/investor-index.json')
    const investorsMap = data && typeof data === 'object' ? data.investors || {} : {}
    const investors = Object.entries(investorsMap)
      .map(([slug, info]) => ({
        slug,
        name: info?.name || '',
        email: info?.email || '',
        status: info?.status || ''
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
