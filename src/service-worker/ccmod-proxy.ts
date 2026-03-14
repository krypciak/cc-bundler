import type { ServiceWorker } from '../../../ccloader3/packages/core/src/service-worker-bridge'
import { requestAndAwaitAck, resolveWaitingFor } from './service-worker-util'

self.addEventListener('activate', () => {
    void self.clients.claim()
})

self.addEventListener('install', () => {
    void self.skipWaiting()
})

const CONTENT_TYPES: Record<string, string> = {
    css: 'text/css',
    js: 'text/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    html: 'text/html',
    htm: 'text/html',
}

function contentType(url: string): string {
    return CONTENT_TYPES[url.substring(url.lastIndexOf('.') + 1)] || 'text/plain'
}

let validPathPrefixes: string[] | null

self.addEventListener('message', event => {
    const packet: ServiceWorker.Outgoing.Packet = event.data

    if (packet.type === 'ValidPathPrefixes') {
        validPathPrefixes = packet.validPathPrefixes
    } else {
        resolveWaitingFor(packet.path, packet)
    }
})

async function requestContents(path: string): Promise<Response> {
    const { data } = await requestAndAwaitAck({ type: 'Path', path })

    if (!data) {
        return new Response(null, { status: 404 })
    }

    return new Response(data, {
        headers: {
            'Content-Type': contentType(path),
        },
        status: 200,
        statusText: 'ok',
    })
}

self.addEventListener('fetch', (event: FetchEvent) => {
    const { request } = event
    const path = decodeURI(new URL(request.url).pathname)

    if (validPathPrefixes?.some(pathPrefix => path.startsWith(pathPrefix))) {
        event.respondWith(requestContents(path))
    }
})
