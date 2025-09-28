import { getClient, requestContents } from './opfs-proxy'
import type { ServiceWorker } from '../../../ccloader3/packages/core/src/service-worker-bridge'
import { shouldIgnoreRequestPath } from './ignored-paths'

function shouldHandleUrl(url: string): boolean {
    const path = decodeURI(new URL(url).pathname)
    if (
        url.startsWith('https://127.0.0.1') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('https://localhost') ||
        url.startsWith('http://localhost')
    )
        return false

    console.log(path, !shouldIgnoreRequestPath(path))
    return !shouldIgnoreRequestPath(path)
}

self.addEventListener('fetch', (event: FetchEvent) => {
    const url = event.request.url
    if (!shouldHandleUrl(url)) return

    event.respondWith(handle(event))
})

async function handle(event: FetchEvent): Promise<Response> {
    const url = event.request.url
    const hasClient = !!(await getClient())

    if (!hasClient) return fetch(event.request)

    // @ts-expect-error
    const packet: ServiceWorker.Incoming.PathPacket = { type: 'URL', path: url }
    return requestContents(packet)
}
