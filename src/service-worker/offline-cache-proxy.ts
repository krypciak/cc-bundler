import { shouldIgnoreRequestPath } from './ignored-paths'

const cacheName = 'crosscode-web-offline-cache'

async function respond(event: FetchEvent): Promise<Response> {
    const request = event.request
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse

    let url = request.url
    const path = decodeURI(new URL(url).pathname)

    if (shouldIgnoreRequestPath(path)) return fetch(request)

    const fetchReq = await fetch(request, { cache: 'no-cache' })
    if (fetchReq.status == 200) {
        const responseClone = fetchReq.clone()

        caches.open(cacheName).then(cache => {
            cache.put(request, responseClone)
        })
    }
    return fetchReq
}

self.addEventListener('fetch', (event: FetchEvent) => {
    event.respondWith(respond(event))
})
