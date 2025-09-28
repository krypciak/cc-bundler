import metadata from '../../../ccloader3/metadata.json'
import { updateUI } from '../ui'
import { nwGui } from '../nwjs-fix'
import { copyFiles, zipToFileEntryList } from '../upload-processing'

import { init, fs } from './opfs'
import { FileEntry, fileEntryFromJson, getUint8Array } from '../utils'
import { runtimeModsDirtyKey } from '../main'
export { fs }

export async function clearStorage() {
    await fs.clearStorage()

    await preloadInit()
    localStorage[runtimeModsDirtyKey] = 'true'
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

export async function getCCLoader3RuntimeModFiles(): Promise<FileEntry[]> {
    try {
        const resp = await fetch('ccloader3-runtime.zip')
        if (resp.status != 200) throw new Error(`bad status: ${resp.status}`)
        const data = await getUint8Array(resp)
        const runtimeModFiles = await zipToFileEntryList(data, 'ccloader3/dist/runtime/')
        return runtimeModFiles
    } catch (e) {
        console.error('unable to fetch ccloader3 runtime files!', e)
        return []
    }
}

export async function getRuntimeModFiles(): Promise<FileEntry[]> {
    try {
        const resp = await fetch('bundler-runtime.zip')
        if (resp.status != 200) throw new Error(`bad status: ${resp.status}`)
        const data = await getUint8Array(resp)
        const runtimeModFiles = await zipToFileEntryList(data, 'assets/mods/cc-bundler-runtime/')
        return runtimeModFiles
    } catch (e) {
        console.error('unable to fetch runtime files!', e)
        return []
    }
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
