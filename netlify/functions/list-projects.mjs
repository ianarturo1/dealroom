import { ok, text, readLocalJson } from './_lib/utils.mjs'

export async function handler(){
  try{
    const items = await readLocalJson('data/projects.json')
    return ok(items)
  }catch(err){
    return text(500, err.message)
  }
}
