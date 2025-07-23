import { configure, fs, InMemory } from '@zenfs/core'
import { IndexedDB } from '@zenfs/dom'
import { Zip } from '@zenfs/archives'
import { mountChangeEvent } from './ui'
export { fs }

export function clearAssets() {
    const req = indexedDB.deleteDatabase('zenfs')
    req.onsuccess = () => location.reload()
    req.onerror = () => location.reload()
    req.onblocked = () => location.reload()
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
    await configure({
        mounts: {
            '/': { backend: InMemory },
            '/assets': { backend: IndexedDB },
            '/dist/runtime': { backend: Zip, data: await loadRuntimeModData() },
        },
    })
    console.log('mounted!')
    // console.log(fs.readdirSync('/assets'))

    ccloaderVersion = metadata.version
    await fs.promises.writeFile('/metadata.json', JSON.stringify(metadata))

    isMounted = true
    mountChangeEvent()
}
