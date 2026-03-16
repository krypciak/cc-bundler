import { FileTransfer } from '@capacitor/file-transfer'
import { Filesystem, Directory } from '@capacitor/filesystem'
import type { ServiceWorker } from '../../ccloader3/packages/core/src/service-worker-bridge'
import { fs } from './fs/opfs'

function sendServiceWorkerMessage(packet: ServiceWorker.Outgoing.Packet): void {
    const { controller } = window.navigator.serviceWorker
    controller?.postMessage(packet)
}

let tmpDownloadCounter = 0

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
            /* this can only happen when WEB=false */
            // @ts-expect-error
            const url: string = packet.path
            const path = `tmp_download_${tmpDownloadCounter++}`

            const fileInfo = await Filesystem.getUri({ path, directory: Directory.Cache })

            let data: Uint8Array | null = null
            try {
                const downloadResult = await FileTransfer.downloadFile({ path: fileInfo.uri, url })

                if (downloadResult?.blob) {
                    /* this shouldn't happen, since result.blob is only set in web view, so never */
                    const arrayBuffer = await downloadResult.blob.arrayBuffer()
                    data = new Uint8Array(arrayBuffer)
                } else {
                    const contents = await Filesystem.readFile({ path, directory: Directory.Cache })

                    if (typeof contents.data === 'string') {
                        const res = await fetch(`data:application/octet-stream;base64,${contents.data}`)
                        data = new Uint8Array(await res.arrayBuffer())
                    } else {
                        const arrayBuffer = await contents.data.arrayBuffer()
                        data = new Uint8Array(arrayBuffer)
                    }
                }

                await Filesystem.deleteFile({ path, directory: Directory.Cache })
            } catch (e) {
                console.log('error while downloading file', e)
            }

            const responsePacket: ServiceWorker.Outgoing.Packet = {
                type: 'Data',
                path: url,
                data: data as any,
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
