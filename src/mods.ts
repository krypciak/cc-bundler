import { Mod, type Modloader } from '../../ccloader/js/mod.js'
import { PkgCCMod } from 'ccmoddb/build/src/types'

interface ModConfigInput {
    baseDirectory: string
    ccmod: PkgCCMod

    getPlugin?: () => Promise<any>
    preload?: () => Promise<void>
    prestart?: () => Promise<void>
    postload?: () => Promise<void>
    poststart?: () => Promise<void>
}
interface ModConfig extends ModConfigInput {
    mod: Mod
}

async function ccmod(): Promise<ModConfigInput[]> {
    return [
        {
            baseDirectory: 'mods/cc-ts-template-esbuild',
            ccmod: (await import('../../assets/mods/cc-ts-template-esbuild/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/cc-ts-template-esbuild/plugin.js'),
        },
        {
            baseDirectory: 'mods/ccmodmanager',
            ccmod: (await import('../../assets/mods/ccmodmanager/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/ccmodmanager/plugin.js'),
        },
    ]
}

const modloader = {
    fileManager: {},
} as Modloader
let mods: ModConfig[] = []

export async function init() {
    const activeMods: Mod[] = []
    mods = await Promise.all(
        (await ccmod()).map(async config => {
            const id = config.ccmod.id
            const mod = new Mod(modloader)
            activeMods.push(mod)

            mod.name = id
            mod.disabled = false
            // @ts-expect-error
            mod.displayName = config.ccmod.title ?? id
            if (typeof mod.displayName === 'object') mod.displayName = mod.displayName['en_US'] ?? id
            mod.hidden = false
            mod.version = config.ccmod.version!

            mod.name = config.ccmod.id
            // @ts-expect-error
            mod.displayName = (config.ccmod.title && config.ccmod.title['en_US']) ?? config.ccmod.title
            // @ts-expect-error
            mod.description = (config.ccmod.description && config.ccmod.description['en_US']) ?? config.ccmod.description
            // @ts-expect-error
            mod.icons = config.ccmod.icons
            mod.version = config.ccmod.version ?? '0.0.0'
            mod.module = false
            mod.hidden = config.ccmod.id === 'Simplify'

            mod.baseDirectory = config.baseDirectory
            mod.assets = []
            mod.dependencies = config.ccmod.dependencies ?? {}

            // @ts-expect-error
            mod.repository = config.ccmod.repository
            // @ts-expect-error
            mod.homepage = config.ccmod.homepage

            if (config.getPlugin) {
                const clazz = (await config.getPlugin()).default
                const plugin = new clazz(mod)
                mod.pluginInstance = plugin as any
            }
            return Object.assign(config, {
                mod,
            })
        })
    )

    // @ts-expect-error
    window.versions = {
        ccloader: '2.25.3',
        crosscode: '1.4.2',
    }
    // @ts-expect-error
    window.inactiveMods = []
    // @ts-expect-error
    window.activeMods = activeMods
}

export async function runPreload() {
    for (const mod of mods) {
        await mod.mod.loadPreload()
        if (mod.preload) await mod.preload()
    }
}

export async function runPrestart() {
    for (const mod of mods) {
        await mod.mod.loadPrestart()
        if (mod.prestart) await mod.prestart()
    }
}
export async function runPostload() {
    for (const mod of mods) {
        await mod.mod.loadPostload()
        if (mod.postload) await mod.postload()
    }
}
export async function runPoststart() {
    for (const mod of mods) {
        await mod.mod.load()
        if (mod.poststart) await mod.poststart()
    }
}
