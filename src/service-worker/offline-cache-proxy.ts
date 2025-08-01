const cacheName = 'cc-bundler-offline-cache'

let currentVersion: number | undefined

export interface VersionResp {
    previousVersion: number | undefined
    version: number | undefined
    updated: boolean
}

async function respond(event: FetchEvent): Promise<Response> {
    const request = event.request
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse

    let url = request.url
    const path = decodeURI(new URL(url).pathname)

    if (path == '/details' || path == '/icon' || path.startsWith('/socket.io/')) return fetch(request)

    if (path == '/version') {
        const previousVersion = currentVersion

        let updated: boolean = false
        try {
            const resp = await fetch(request, { cache: 'no-cache' })
            const versionStr = await resp.text()
            const version = parseInt(versionStr)

            if (currentVersion != version) {
                currentVersion = version

                await caches.delete(cacheName)
                updated = true
            }
        } catch (e) {
            console.error('ServiceWorker /version fetch failed:', e)
        }

        const versionResp: VersionResp = {
            previousVersion,
            version: currentVersion,
            updated,
        }

        return new Response(JSON.stringify(versionResp), {
            status: 200,
        })
    }

    const fetchReq = await fetch(request, { cache: 'no-cache' })
    const responseClone = fetchReq.clone()

    caches.open(cacheName).then(cache => {
        cache.put(request, responseClone)
    })
    return fetchReq
}

self.addEventListener('fetch', (event: FetchEvent) => {
    event.respondWith(respond(event))
})
