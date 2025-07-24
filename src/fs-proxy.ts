import { configureSingle, fs } from '@zenfs/core'
import { WebAccess } from '@zenfs/dom'
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

import metadata from '../../ccloader3/metadata.json'

export async function preloadInit() {
    console.log('mounting...')
    const root = await navigator.storage.getDirectory()

    await configureSingle({
        backend: WebAccess,
        handle: root,
    })
    console.log('mounted!')

    ccloaderVersion = metadata.version
    await fs.promises.writeFile('/metadata.json', JSON.stringify(metadata))

    isMounted = true
    updateUI()
}
