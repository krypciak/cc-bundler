import type { ServiceWorker } from '../../../ccloader3/packages/core/src/service-worker-bridge'

export async function getClient() {
    const clients = await self.clients.matchAll()
    const client = clients[0]
    return client
}

async function post(data: ServiceWorker.Incoming.Packet): Promise<void> {
    const client = await getClient()
    client.postMessage(data)
}

type ResolveFunc = (packet: ServiceWorker.Outgoing.DataPacket) => void
const waitingFor = new Map<string, ResolveFunc[]>()

export function resolveWaitingFor(path: string, packet: ServiceWorker.Outgoing.DataPacket) {
    for (const func of waitingFor.get(path) ?? []) {
        func(packet)
    }
    waitingFor.delete(path)
}

function push(path: string, resolve: ResolveFunc) {
    if (waitingFor.has(path)) {
        waitingFor.get(path)!.push(resolve)
    } else {
        waitingFor.set(path, [resolve])
    }
}

export async function requestAndAwaitAck(
    packet: ServiceWorker.Incoming.PathPacket
): Promise<ServiceWorker.Outgoing.DataPacket> {
    return new Promise<ServiceWorker.Outgoing.DataPacket>(resolve => {
        push(packet.path, resolve)
        void post(packet)
    })
}
