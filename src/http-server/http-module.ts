import type { InputLocations } from 'ccmoddb/build/src/types'
import type { IncomingMessage, ServerResponse } from 'http'
import type { createServer } from 'http-server'
import NodeFetchCache, { MemoryCache } from 'node-fetch-cache'

let allowedDbs: string[] = []
export function setAllowedDbs(dbs: string[]) {
    allowedDbs = dbs
}

const fetchWithCache = NodeFetchCache.create({
    shouldCacheResponse: response => response.ok,
    cache: new MemoryCache({
        ttl: 1000 * 60 * 3, // 3 days
    }),
})

async function fetchData(url: string): Promise<Uint8Array> {
    const resp = await fetchWithCache(url)
    const data = new Uint8Array(await resp.arrayBuffer())

    return data
}

const updateInputLocationsEveryMs = 1000 * 60 * 60 // hour
let lastInputLocationsFetched = 0
const validUrlSet: Set<string> = new Set()

async function addAllowedDb(url: string) {
    validUrlSet.add(`${url}/npDatabase.min.json`)

    const inputLocationsUrl = `${url}/input-locations.json`
    try {
        const inputLocations: InputLocations = await (await fetch(inputLocationsUrl)).json()
        for (const { url } of inputLocations) {
            validUrlSet.add(url)
        }
    } catch (e) {
        console.error('error while fetching database:', inputLocationsUrl, 'error:', e)
    }
}

export async function updateValidUrlSet() {
    validUrlSet.clear()
    await Promise.all(allowedDbs.map(db => addAllowedDb(db)))
    lastInputLocationsFetched = Date.now()
}

async function checkUpdate() {
    if (lastInputLocationsFetched > Date.now() - updateInputLocationsEveryMs) return
    await updateValidUrlSet()
}

function checkUrl(url: string | undefined): url is string {
    if (!url) return false

    return validUrlSet.has(url)
}

async function sha256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const result = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return result
}

export type HandleFunction = NonNullable<NonNullable<Parameters<typeof createServer>[0]>['before']>[number]

export const handleFunction: HandleFunction = async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? ''

    try {
        await checkUpdate()

        if (url.startsWith('/modDownload')) {
            const matches = url.match(/\?url=(.+)/)
            const modUrl = matches?.[1]

            if (!checkUrl(modUrl)) {
                res.writeHead(403, {})
                res.end()

                return
            }

            const data = await fetchData(modUrl)
            const etag = await sha256(data)

            res.writeHead(200, {
                'Content-Type': 'application/zip',
                Etag: etag,
            })
            res.write(data)
            res.end()
        } else {
            res.emit('next')
        }
    } catch (e) {
        console.error(e)
        res.emit('next')
    }
}
