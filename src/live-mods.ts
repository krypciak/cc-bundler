import { copyFiles } from './upload-processing'
import { getUint8Array } from './utils'
import { fs } from './fs/opfs'

export async function updateLiveMods() {
    try {
        const resp = await fetch('/liveModUpdate?id=list')
        if (resp.status !== 200) throw new Error(`bad status: ${resp.status}`)
        const list: string[] = await resp.json()
        let pathList = list.map(id => ({ id, path: `/assets/mods/${id}.ccmod` }))

        const exitsArr = await Promise.all(pathList.map(({ path }) => fs.promises.exists(path)))
        pathList = pathList.filter(({ id }, i) => localStorage[`modEnabled-${id}`] == 'true' || !exitsArr[i])

        const files = await Promise.all(
            pathList.map(async ({ id, path }) => ({
                path,
                data: getUint8Array(await fetch(`/liveModUpdate?id=${id}`)),
            }))
        )
        const fileList = files.map(({ path, data }) => ({ path, uint8Array: () => data }))
        await copyFiles(fileList, false)
    } catch (e) {
        console.error('updateLiveMods error:', e)
    }
}
