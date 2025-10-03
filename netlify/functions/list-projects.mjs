import { readLocalJson } from './_lib/utils.mjs'
import { json, errorJson } from './_shared/http.mjs'

export default async function handler(request, context){
  try{
    const items = await readLocalJson('data/projects.json')
    return json(items)
  }catch(err){
    return errorJson(err.message || 'Internal error')
  }
}
