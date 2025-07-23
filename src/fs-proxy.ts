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

export async function preloadInit() {
    console.log('mounting...')
    await configure({
        mounts: {
            '/': { backend: InMemory },
            '/assets': { backend: IndexedDB },
            '/dist': { backend: Zip, data: await (await fetch('./runtime.ccmod')).arrayBuffer() },
        },
    })
    console.log('mounted!')
    // console.log(fs.readdirSync('/assets'))

    await fs.promises.writeFile('/metadata.json', '{ "version": "3.3.3-alpha" }')

    isMounted = true
    mountChangeEvent()
}
