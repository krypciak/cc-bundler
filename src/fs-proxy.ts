import { updateUI } from './ui'

import { init, fs } from './opfs'
export { fs }

export async function clearStorage() {
    await fs.clearStorage()

    preloadInit()
}

export let isMounted = false
export let ccloaderVersion: string | undefined

import metadata from '../../ccloader3/metadata.json'

export async function preloadInit() {
    await init()

    ccloaderVersion = metadata.version
    await fs.promises.writeFile('/metadata.json', JSON.stringify(metadata))

    isMounted = true
    updateUI()
}
