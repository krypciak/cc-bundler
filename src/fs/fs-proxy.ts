import metadata from '../../../ccloader3/metadata.json'
import { updateUI } from '../ui'
import { nwGui } from '../nwjs-fix'
import { copyFiles, zipToFileEntryList } from '../upload-processing'
import { getRuntimeModFiles } from '../runtime-mod'

import { init, fs } from './opfs'
import { FileEntry, fileEntryFromJson, getUint8Array } from '../utils'
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

function getCCLoader3MetadataFile(): FileEntry {
    return fileEntryFromJson('ccloader3/metadata.json', metadata)
}

export async function getInternalFileList(): Promise<FileEntry[]> {
    const files: FileEntry[] = []
    files.push(...(await getCCLoader3RuntimeModFiles()))
    files.push(...(await getRuntimeModFiles()))
    files.push(getCCLoader3MetadataFile())

    return files
}

export async function copyInternalFiles() {
    const files = await getInternalFileList()
    await copyFiles(files, false)
}
