import fs from 'fs/promises'
import path from 'path'

function json(statusCode, data, headers){
  return {
    statusCode,
    headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
    body: JSON.stringify(data)
  }
}

function ok(data, headers){
  return json(200, data, headers)
}

function text(status, txt, headers){
  return { statusCode: status, headers: Object.assign({'content-type':'text/plain'}, headers || {}), body: txt }
}

async function readLocalJson(relPath){
  const file = path.join(process.cwd(), relPath)
  const txt = await fs.readFile(file, 'utf-8')
  return JSON.parse(txt)
}

export { json, ok, text, readLocalJson }
