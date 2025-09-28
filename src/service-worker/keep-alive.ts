self.addEventListener('fetch', (event: FetchEvent) => {
    let url = event.request.url
    const path = decodeURI(new URL(url).pathname)

    if (path == '/ping.txt') event.respondWith(new Response('', { status: 200 }))
})
