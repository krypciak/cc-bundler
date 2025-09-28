import { CapacitorHttp, HttpResponse } from '@capacitor/core'
import type { ServiceWorker } from '../../ccloader3/packages/core/src/service-worker-bridge'
import { fs } from './fs/opfs'

function sendServiceWorkerMessage(packet: ServiceWorker.Outgoing.Packet): void {
    const { controller } = window.navigator.serviceWorker
    controller?.postMessage(packet)
}

export function initOpfsProxyBridge() {
    const ccmodOnMessage = navigator.serviceWorker.onmessage

    async function opfsProxyBridgeOnMessage(this: ServiceWorkerContainer, event: MessageEvent): Promise<boolean> {
        const packet: ServiceWorker.Incoming.Packet = event.data

        if (packet.type === 'Path') {
            const { path } = packet
            if (await fs.promises.exists(path)) {
                const responsePacket: ServiceWorker.Outgoing.Packet = {
                    type: 'Data',
                    path,
                    data:
                        (await fs.promises.readFile(path).catch(e => {
                            console.error(`error while handing fetch of ${path}:`, e)
                        })) ?? null,
                }

                sendServiceWorkerMessage(responsePacket)
                return true
            }
            // @ts-expect-error
        } else if (packet.type === 'URL') {
            // @ts-expect-error
            const url: string = packet.path

            const response: HttpResponse = await CapacitorHttp.get({
                url,
                responseType: 'arraybuffer',
            })
            const data = Uint8Array.from(atob(response.data), c => c.charCodeAt(0))

            const responsePacket: ServiceWorker.Outgoing.Packet = {
                type: 'Data',
                path: url,
                data,
            }

            sendServiceWorkerMessage(responsePacket)
            return true
        }

        return false
    }

    async function onmessage(this: ServiceWorkerContainer, event: MessageEvent) {
        if (await opfsProxyBridgeOnMessage.call(this, event)) return
        await ccmodOnMessage?.call(this, event)
    }

    navigator.serviceWorker.onmessage = onmessage
    Object.defineProperty(navigator.serviceWorker, 'onmessage', {
        get() {
            return onmessage
        },
        set(_v) {},
    })

    /* prevent service worker from going to sleep */
    /* insert evil laughter */
    setInterval(() => {
        fetch('/ping.txt')
    }, 20e3)
}
