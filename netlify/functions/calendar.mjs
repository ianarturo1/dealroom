import { readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'
import { binary, errorJson, getUrlAndParams } from './_shared/http.mjs'

function esc(s){ return (s||'').replace(/[,\\n]/g,' ') }
function icsEvent(uid, startDate, endDate, summary, description){
  return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${startDate}T090000Z
DTSTART;VALUE=DATE:${startDate}
DTEND;VALUE=DATE:${endDate}
SUMMARY:${esc(summary)}
DESCRIPTION:${esc(description)}
END:VEVENT`
}

export default async function handler(request, context){
  try{
    const { params } = getUrlAndParams(request)
    const slug = (params.get('slug') || 'femsa').trim() || 'femsa'
    const repo = process.env.CONTENT_REPO
    const branch = process.env.CONTENT_BRANCH || 'main'

    let data
    if (!repo || !process.env.GITHUB_TOKEN){
      data = await readLocalJson(`data/investors/${slug}.json`)
    } else {
      const file = await getFile(repo, `data/investors/${slug}.json`, branch)
      const buff = Buffer.from(file.content, file.encoding || 'base64')
      data = JSON.parse(buff.toString('utf-8'))
    }

    const events = Object.entries(data.deadlines || {}).map(([k, v], i) => 
      icsEvent(`${slug}-${k}-${i}`, v.replaceAll('-',''), v.replaceAll('-',''), `${data.name}: ${k}`, `Hito del dealroom: ${k}`)
    ).join('\n')

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Finsolar Dealroom//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events}
END:VCALENDAR`

    return binary(ics, {
      filename: `${slug}.ics`,
      contentType: 'text/calendar',
      disposition: 'attachment'
    })
  }catch(err){
    return errorJson(err.message || 'Internal error')
  }
}
