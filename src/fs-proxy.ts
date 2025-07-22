import { configure, fs, InMemory } from '@zenfs/core'
import { IndexedDB } from '@zenfs/dom'
import { Zip } from '@zenfs/archives'
export { fs }

export async function preloadInit() {
    const runtimeData = await (await fetch('./runtime.ccmod')).arrayBuffer()

    console.log('mounting...')
    await configure({
        mounts: {
            '/': { backend: InMemory },
            '/assets': { backend: IndexedDB },
            '/dist/runtime': { backend: Zip, data: runtimeData },
        },
    })
    console.log('mounted!')

    if (!(await fs.promises.exists('/assets/copied'))) {
        console.log('loading assets...')
        const assetsData = await (await fetch('./_assets.zip')).arrayBuffer()
        console.log('assets data loaded!')

        await configure({
            mounts: {
                '/tmp_assets': { backend: Zip, data: assetsData },
            },
        })

        const files = await fs.promises.readdir('/tmp_assets')
        for (const file of files) {
            const dest = `/assets/${file}`
            if (await fs.promises.exists(dest)) continue

            if (file == 'mod-data') continue

            console.log('copying', file)
            await fs.promises.cp(`/tmp_assets/${file}`, dest, { recursive: true })
        }

        console.log('done')
        fs.promises.writeFile('/assets/copied', 'yes')
    }

    await fs.promises.writeFile('/metadata.json', '{ "version": "3.3.3-alpha" }')
}

export const path = {
    join(a: string, b: string) {
        return a + '/' + b
    },
}
