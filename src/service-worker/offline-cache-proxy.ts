const cacheName = 'cc-bundler-offline-cache'

let currentVersion: number | undefined

export interface VersionResp {
    previousVersion: number | undefined
    version: number | undefined
    updated: boolean
}

async function respond(event: FetchEvent): Promise<Response> {
    const cachedResponse = await caches.match(event.request)

    const url = event.request.url
    const path = decodeURI(new URL(url).pathname)

    if (path == '/version') {
        const previousVersion = currentVersion

        let updated: boolean = false
        try {
            const resp = await fetch(event.request)
            const versionStr = await resp.text()
            const version = parseInt(versionStr)

            if (currentVersion != version) {
                console.log('updating from', currentVersion, 'to', version)
                currentVersion = version

                caches.delete(cacheName)
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

    const fetchReq = fetch(event.request)
    fetchReq
        .then(async response => {
            const responseClone = response.clone()

            caches.open(cacheName).then(cache => {
                cache.put(event.request, responseClone)
            })
            return response
        })
        .catch(reason => {
            console.error('ServiceWorker fetch failed: ', reason)
        })

    return cachedResponse || fetchReq
}

self.addEventListener('fetch', (event: FetchEvent) => {
    event.respondWith(respond(event))
})
