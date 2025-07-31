const cacheName = 'cc-bundler-offline-cache'

async function respond(event: FetchEvent) {
    const cachedResponse = await caches.match(event.request)

    const networkFetch = fetch(event.request)

    networkFetch
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

    return cachedResponse || networkFetch
}

self.addEventListener('fetch', (event: FetchEvent) => {
    event.respondWith(respond(event))
})
