declare global {
    interface Window {
        CrosscodeWebAndroidNative?: {
            reportRumble(strength: number, effectDuration: number): void
            fetchBinary(url: string, callbackId: string): void
            setFullscreen(): void
            saveFile(base64: string, fileName: string): string
        }
        _crosscodeWebCallbacks: {
            fetchBinary: {
                success(callbackId: string, data: string): void
                error(callbackId: string, error: string): void
            }
        }
    }
}

export function isAndroid(): boolean {
    return !!window.CrosscodeWebAndroidNative
}

export function reportRumbleAndroid(strength: number, effectDuration: number) {
    window.CrosscodeWebAndroidNative!.reportRumble(strength, effectDuration)
}

export function setFullscreenAndroid(): void {
    window.CrosscodeWebAndroidNative!.setFullscreen()
}

export function saveFileAndroid(base64: string, fileName: string): string {
    const result = window.CrosscodeWebAndroidNative!.saveFile(base64, fileName)
    if (result.startsWith("ERROR: ")) {
        throw new Error(result.substring(7))
    }
    return result
}

const pendingCallbacks = new Map<string, { resolve: (data: Uint8Array) => void; reject: (error: string) => void }>()

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

window._crosscodeWebCallbacks = {
    fetchBinary: {
        success(callbackId, data) {
            pendingCallbacks.get(callbackId)?.resolve(base64ToUint8Array(data))
            pendingCallbacks.delete(callbackId)
            console.timeEnd('download')
        },
        error(callbackId, error) {
            pendingCallbacks.get(callbackId)?.reject(error)
            pendingCallbacks.delete(callbackId)
            console.timeEnd('download')
        },
    },
}

let callbackCounter = 0

export async function fetchBinaryAndroid(url: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const callbackId = String(++callbackCounter)
        pendingCallbacks.set(callbackId, { resolve, reject })
        window.CrosscodeWebAndroidNative!.fetchBinary(url, callbackId)
    })
}
