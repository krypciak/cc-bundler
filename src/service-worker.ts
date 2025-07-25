import type { ServiceWorkerPacket } from '../../ccloader3/packages/core/src/service-worker-bridge'
import { handle } from './mod-download-proxy'

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

async function post(data: unknown): Promise<void> {
    const clients = await self.clients.matchAll()
    const client = clients[0]
    client.postMessage(data)
}

const waitingFor = new Map<string, (packet: ServiceWorkerPacket) => void>()

async function requestContents(path: string): Promise<Response> {
    let resolve!: (packet: ServiceWorkerPacket) => void
    const promise = new Promise<ServiceWorkerPacket>(res => {
        resolve = res
    })
    await post(path)

    waitingFor.set(path, resolve)

    const { data } = await promise
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

let validPathPrefixes: string[] | undefined

self.addEventListener('message', event => {
    if (Array.isArray(event.data)) {
        validPathPrefixes = event.data
    } else {
        const packet: ServiceWorkerPacket = event.data
        const resolve = waitingFor.get(packet.path)!
        resolve(packet)
        waitingFor.delete(packet.path)
    }
})

self.addEventListener('fetch', (event: FetchEvent) => {
    if (!validPathPrefixes) {
        return
    }

    if (handle(event)) return

    const { request } = event
    const path = decodeURI(new URL(request.url).pathname)

    if (validPathPrefixes.some(pathPrefix => path.length > pathPrefix.length && path.startsWith(pathPrefix))) {
        event.respondWith(requestContents(path))
    }
})
