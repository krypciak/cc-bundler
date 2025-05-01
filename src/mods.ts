import { Mod, type Modloader } from '../../ccloader/js/mod'
import type { PkgCCMod } from 'ccmoddb/build/src/types'

interface ModConfigInput {
    baseDirectory: string
    ccmod: PkgCCMod

    getPlugin?: () => Promise<any>
    pluginClassPatch?: (plugin: any) => void
    preload?: () => void | Promise<void>
    prestart?: () => void | Promise<void>
    postload?: () => void | Promise<void>
    poststart?: () => void | Promise<void>
}
interface ModConfig extends ModConfigInput {
    mod: Mod
}

declare global {
    var activeMods: Mod[]
    var inactiveMods: Mod[]
    var versions: { ccloader: string; crosscode: string }
    var cc: Window
    var simplifyResources: any
    var simplify: any
    var ccbundler: boolean
}

async function ccmod() {
    async function fixImageLoad(path: string) {
        let src: string
        if (path.startsWith('data')) src = path
        else {
            const data = await fsProxy.fs.promises.readFile(path)
            // @ts-expect-error
            const base64 = data.toBase64()
            src = 'data:image/png;base64,' + base64
        }

        const img = new Image()
        const promise = new Promise<void>(res => {
            img.onload = () => res()
        })
        img.src = src

        await promise
        return img
    }
    return [
        /* simplify */ {
            baseDirectory: 'mods/simplify',
            ccmod: (await import('../../assets/mods/simplify/ccmod.json')) as PkgCCMod,
            getPlugin: async () => ({
                default: class CustomSimplify {
                    baseDir: string
                    constructor(mod: Mod) {
                        this.baseDir = mod.baseDirectory
                        window.cc = window
                    }
                    async prestart() {
                        const { fixPatterns } = await import('../../assets/mods/simplify/pattern-fix.js')
                        fixPatterns()

                        // const patchSteps = await import('../../assets/mods/simplify/lib/patch-steps-lib/src/patchsteps.js')
                        window.simplifyResources = {
                            patchSteps: {
                                // callable: patchSteps.callable,
                                callable: undefined,
                            },
                        }

                        window.simplify = {
                            resources: window.simplifyResources,
                            getMod: (name: string) => window.activeMods.find(mod => mod.name == name),
                        }
                    }
                },
            }),
            // poststart: () => require('../../assets/mods/simplify/mod.js'),
            preload: () => require('../../assets/mods/simplify/preload.js'),
            postload: () => require('../../assets/mods/simplify/postload.js'),
            // prestart: () => require('../../assets/mods/simplify/prestart.js'),
        },
        /* ccloader-version-display */ {
            baseDirectory: 'mods/ccloader-version-display',
            ccmod: (await import('../../assets/mods/ccloader-version-display/ccmod.json')) as PkgCCMod,
            prestart: () => require('../../assets/mods/ccloader-version-display/prestart.js'),
        },
        /* cc-ts-template-esbuild */ {
            baseDirectory: 'mods/cc-ts-template-esbuild',
            ccmod: (await import('../../assets/mods/cc-ts-template-esbuild/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/cc-ts-template-esbuild/plugin.js'),
        },
        /* ccmodmanager */ {
            baseDirectory: 'mods/ccmodmanager',
            ccmod: (await import('../../assets/mods/ccmodmanager/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/ccmodmanager/plugin.js'),
        },
        // /* nax-module-cache */ {
        //     baseDirectory: 'mods/nax-module-cache',
        //     ccmod: (await import('../../assets/mods/nax-module-cache/ccmod.json')) as PkgCCMod,
        //     getPlugin: () => import('../../assets/mods/nax-module-cache/nax-module-cache/plugin.js'),
        // },
        // /* nax-ccuilib */ {
        //     baseDirectory: 'mods/nax-ccuilib',
        //     ccmod: (await import('../../assets/mods/nax-ccuilib/ccmod.json')) as PkgCCMod,
        //     getPlugin: () => import('../../assets/mods/nax-ccuilib/nax-ccuilib/plugin.js'),
        //     pluginClassPatch: (plugin: InstanceType<(typeof import('../../assets/mods/nax-ccuilib/nax-ccuilib/plugin.js'))['default']>) => {
        //         const orig = plugin.prestart
        //         plugin.prestart = () => {
        //             const backup = ig._loadScript
        //             ig._loadScript = () => {}
        //             orig.call(plugin)
        //             ig._loadScript = backup
        //         }
        //     },
        //     prestart: () => {
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui/quick-menu/default-widgets.js')
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui/quick-menu/button-traversal-patch.js')
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui/quick-menu/quick-menu-extension.js')
        //
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui/input-field-cursor.js')
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui/input-field.js')
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui/test-menu.js')
        //         require('../../assets/mods/nax-ccuilib/nax-ccuilib/ui.js')
        //     },
        // },
        // /* char-select */ {
        //     baseDirectory: 'mods/char-select',
        //     ccmod: (await import('../../assets/mods/char-select/ccmod.json')) as PkgCCMod,
        //     preload: () => require('../../assets/mods/char-select/preload.js'),
        //     prestart: () => require('../../assets/mods/char-select/prestart.js'),
        // },
        // /* cc-alyxbox */ {
        //     baseDirectory: 'mods/cc-alybox',
        //     ccmod: (await import('../../assets/mods/cc-alybox/ccmod.json')) as PkgCCMod,
        //     prestart: () => {
        //         /* no need to import the patch steps */
        //         require('../../assets/mods/cc-alybox/src/_core.js')
        //         require('../../assets/mods/cc-alybox/src/enemy-var-path.js')
        //         require('../../assets/mods/cc-alybox/src/player-name.js')
        //     },
        // },
        // /* extension-assert-preloader */ {
        //     baseDirectory: 'mods/extension-asset-preloader',
        //     ccmod: (await import('../../assets/mods/extension-asset-preloader/ccmod.json')) as PkgCCMod,
        //     /* not required with vfs */
        //     // postload: () => require('../../assets/mods/extension-asset-preloader/postload.js'),
        // },
        // /* menu-ui-replacer */ {
        //     baseDirectory: 'mods/menu-ui-replacer',
        //     ccmod: (await import('../../assets/mods/menu-ui-replacer/ccmod.json')) as PkgCCMod,
        //     getPlugin: () => import('../../assets/mods/menu-ui-replacer/plugin.js'),
        //     postload: () => require('../../assets/mods/menu-ui-replacer/postload.js'),
        //     pluginClassPatch: (plugin: InstanceType<(typeof import('../../assets/mods/menu-ui-replacer/plugin.js'))['default']>) => {
        //         plugin.getBaseMenuImg = () => fixImageLoad('media/gui/menu.png')
        //     },
        // },
        // /* extendable-severed-heads */ {
        //     baseDirectory: 'mods/extendable-severed-heads',
        //     ccmod: (await import('../../assets/mods/extendable-severed-heads/ccmod.json')) as PkgCCMod,
        //     getPlugin: () => import('../../assets/mods/extendable-severed-heads/plugin.js'),
        //     pluginClassPatch: (plugin: InstanceType<(typeof import('../../assets/mods/extendable-severed-heads/plugin.js'))['default']>) => {
        //         plugin.loadImage = fixImageLoad
        //     },
        // },
        // /* xenon-playable-classes */ {
        //     baseDirectory: 'mods/xenons-playable-classes',
        //     ccmod: (await import('../../assets/mods/xenons-playable-classes/ccmod.json')) as PkgCCMod,
        //     prestart: () => require('../../assets/mods/xenons-playable-classes/prestart.js'),
        //     poststart: () => require('../../assets/mods/xenons-playable-classes/poststart.js'),
        // },
        /* cc-instanceinator */ {
            baseDirectory: 'mods/cc-instanceinator',
            ccmod: (await import('../../assets/mods/cc-instanceinator/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/cc-instanceinator/plugin.js'),
        },
        /* cc-determine */ {
            baseDirectory: 'mods/cc-determine',
            ccmod: (await import('../../assets/mods/cc-determine/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/cc-determine/plugin.js'),
        },
        /* cc-multibakery */ {
            baseDirectory: 'mods/cc-multibakery',
            ccmod: (await import('../../assets/mods/cc-multibakery/ccmod.json')) as PkgCCMod,
            getPlugin: () => import('../../assets/mods/cc-multibakery/plugin.js'),
        },
    ]
}

const modloader = {
    fileManager: {},
} as Modloader

let ccmodRes: Awaited<ReturnType<typeof ccmod>>
export let mods: ModConfig[] = []

export async function init(noOverride?: boolean) {
    const activeMods: Mod[] = []
    window.versions = {
        ccloader: '2.25.3',
        crosscode: '1.4.2',
    }
    window.inactiveMods = []
    window.activeMods = activeMods
    /* some old mods use export default MyMod extends Plugin { */
    // @ts-expect-error
    window.Plugin = class {}
    window.ccbundler = true

    if (!noOverride) {
        window.global = window
        window.process = {
            on(name: string, _func: () => void) {
                if (name == 'on') {
                } else if (name == 'exit') {
                } else {
                    console.warn('Unsupported process.on:', name)
                }
            },
            execPath: 'client',
            versions: {},
        } as any
    }

    ccmodRes = await ccmod()
    mods = ccmodRes.map(config => {
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

        return Object.assign(config, {
            mod,
        })
    })
}

export async function createPlugins() {
    for (let i = 0; i < ccmodRes.length; i++) {
        const config = ccmodRes[i]
        const mod = mods[i].mod

        if (config.getPlugin) {
            const clazz = (await config.getPlugin()).default as any
            const plugin = new clazz(mod)
            mod.pluginInstance = plugin as any
            // @ts-ignore in the case that no mods that have pluginClassPatch
            if (config.pluginClassPatch) {
                // @ts-ignore
                config.pluginClassPatch(plugin)
            }
        }
    }
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
