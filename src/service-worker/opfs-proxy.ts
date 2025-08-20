import type { ServiceWorker } from '../../../ccloader3/packages/core/src/service-worker-bridge'

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

async function post(data: ServiceWorker.Incoming.Packet): Promise<void> {
    const clients = await self.clients.matchAll()
    const client = clients[0]
    client.postMessage(data)
}

const waitingFor = new Map<string, (packet: ServiceWorker.Outgoing.DataPacket) => void>()

async function requestAndAwaitAck(
    packet: ServiceWorker.Incoming.PathPacket
): Promise<ServiceWorker.Outgoing.DataPacket> {
    return new Promise<ServiceWorker.Outgoing.DataPacket>(resolve => {
        waitingFor.set(packet.path, resolve)
        void post(packet)
    })
}

let validPathPrefixes: string[] = ['/assets/', '/ccloader3/']

self.addEventListener('message', event => {
    const packet: ServiceWorker.Outgoing.Packet = event.data

    if (packet.type == 'Data') {
        waitingFor.get(packet.path)?.(packet)
        waitingFor.delete(packet.path)
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
