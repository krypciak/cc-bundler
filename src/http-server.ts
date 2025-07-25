import type { IncomingMessage, ServerResponse } from 'http'
import { createServer } from 'http-server'
import type { InputLocations } from 'ccmoddb/build/src/types'

const updateInputLocationsEveryMs = 1000 * 5 // 1000 * 60 * 60 // hour
let lastInputLocationsFetched = 0
const validUrlSet: Set<string> = new Set()

async function addAllowedDb(url: string) {
    validUrlSet.add(`${url}/npDatabase.min.json`)

    const inputLocations: InputLocations = await (await fetch(`${url}/input-locations.json`)).json()
    for (const { url } of inputLocations) {
        validUrlSet.add(url)
    }
}

async function updateValidUrlSet() {
    validUrlSet.clear()
    await Promise.all([
        addAllowedDb('https://raw.githubusercontent.com/CCDirectLink/CCModDB/stable'),
        addAllowedDb('https://raw.githubusercontent.com/CCDirectLink/CCModDB/testing'),
    ])
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

export async function startHttpServer() {
    await updateValidUrlSet()

    const httpServer = createServer({
        root: './dist',
        cache: 60 * 60 * 24,
        cors: true,
        showDotfiles: false,
        showDir: 'false',
        before: [
            async (req: IncomingMessage, res: ServerResponse) => {
                const url = req.url ?? ''

                await checkUpdate()

                if (url.startsWith('/modDownload')) {
                    const matches = url.match(/\?url=(.+)/)
                    const modUrl = matches?.[1]

                    if (!checkUrl(modUrl)) {
                        res.writeHead(403, {})
                        res.end()

                        return
                    }

                    const data = await (await fetch(modUrl)).bytes()

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
            },
        ],
    })
    const port = 8080
    console.log('http server listening to', port)
    httpServer.listen(port)
}
startHttpServer()
