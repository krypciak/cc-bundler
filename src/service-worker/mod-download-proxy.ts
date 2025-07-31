function isModDownloadPath(url: string): boolean {
    return url.startsWith('https://github.com') || url.startsWith('https://raw.githubusercontent.com')
}

async function handleRequest(url: string): Promise<Response> {
    return fetch(`/modDownload?url=${encodeURI(url)}`)
}

self.addEventListener('fetch', (event: FetchEvent) => {
    const url = event.request.url
    if (!isModDownloadPath(url)) return

    event.respondWith(handleRequest(url))
})
