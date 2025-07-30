import { updateUI } from './ui'

import { init, fs } from './opfs'
export { fs }

export async function clearStorage() {
    await fs.clearStorage()

    await preloadInit()
}

export let isMounted = false
export let ccloaderVersion: string | undefined

import metadata from '../../ccloader3/metadata.json'
import { nwGui } from './nwjs-fix'

export async function preloadInit() {
    await init()

    ccloaderVersion = metadata.version
    await fs.promises.mkdir('ccloader3', { recursive: true })
    await fs.promises.writeFile('ccloader3/metadata.json', JSON.stringify(metadata))
    await fs.promises.mkdir(nwGui.App.dataPath, { recursive: true })

    isMounted = true
    updateUI()
}
