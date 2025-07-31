import metadata from '../../ccloader3/metadata.json'
import { updateUI } from './ui'
import { nwGui } from './nwjs-fix'
import { FileEntry, zipToFileEntryList } from './upload-processing'
import { getRuntimeModFiles } from './runtime-mod'

import { init, fs, getUint8ArrayFromFile as getUint8Array } from './opfs'
export { fs }

export async function clearStorage() {
    await fs.clearStorage()

    await preloadInit()
}

export let isMounted = false
export let ccloaderVersion: string | undefined

export async function preloadInit() {
    await init()

    ccloaderVersion = metadata.version
    await fs.promises.mkdir('ccloader3', { recursive: true })
    await fs.promises.writeFile('ccloader3/metadata.json', JSON.stringify(metadata))
    await fs.promises.mkdir(nwGui.App.dataPath, { recursive: true })

    isMounted = true
    await updateUI()
}

async function loadRuntimeModData(): Promise<Uint8Array> {
    const resp = await fetch('runtime.ccmod')
    return getUint8Array(resp)
}

export async function getCCLoader3RuntimeModFiles(): Promise<FileEntry[]> {
    const data = await loadRuntimeModData()
    const runtimeModFiles = await zipToFileEntryList(data, 'ccloader3/dist/runtime/')
    return runtimeModFiles
}

export async function copyInternalFiles() {
    const files: FileEntry[] = []
    files.push(...(await getCCLoader3RuntimeModFiles()))
    files.push(...(await getRuntimeModFiles()))
}
