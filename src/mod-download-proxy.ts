function isModDownloadPath(url: string): boolean {
    return url.startsWith('https://github.com') || url.startsWith('https://raw.githubusercontent.com')
}
export function handle(event: FetchEvent): boolean {
    const url = event.request.url
    if (!isModDownloadPath(url)) return false

    event.respondWith(handleRequest(url))

    return true
}

async function handleRequest(url: string): Promise<Response> {
    return fetch(`/modDownload?url=${encodeURI(url)}`)
}
