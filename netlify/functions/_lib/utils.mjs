import fs from 'fs/promises'
import path from 'path'

async function readLocalJson(relPath){
  const file = path.join(process.cwd(), relPath)
  const txt = await fs.readFile(file, 'utf-8')
  return JSON.parse(txt)
}
export { readLocalJson }
