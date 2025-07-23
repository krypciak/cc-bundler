import { configure, fs, InMemory } from '@zenfs/core'
import { WebAccess } from '@zenfs/dom'
import { Zip } from '@zenfs/archives'
import { updateUI } from './ui'
export { fs }

export async function clearAssets() {
    const root = await navigator.storage.getDirectory()
    for await (const file of root.values()) {
        await root.removeEntry(file.name, { recursive: true })
    }
    location.reload()
}

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export let isMounted = false
export let ccloaderVersion: string | undefined

import runtimeModJson from '../tmp/runtime.json'

async function loadRuntimeModData(): Promise<Uint8Array> {
    return Uint8Array.from(atob(runtimeModJson.data), c => c.charCodeAt(0))
}

import metadata from '../../ccloader3/metadata.json'

export async function preloadInit() {
    console.log('mounting...')
    const root = await navigator.storage.getDirectory()

    await configure({
        mounts: {
            '/': { backend: InMemory },
            '/assets': { backend: WebAccess, handle: root },
            '/dist/runtime': { backend: Zip, data: await loadRuntimeModData() },
        },
    })
    console.log('mounted!')
    // console.log(fs.readdirSync('/assets'))

    ccloaderVersion = metadata.version
    await fs.promises.writeFile('/metadata.json', JSON.stringify(metadata))

    isMounted = true
    updateUI()
}
