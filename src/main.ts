import $ from 'jquery'
import CryptoJS from 'crypto-js'

// @ts-expect-error
window.$ = $
window.CryptoJS = CryptoJS

/* Set variables from assets/node-webkit.html */
window.IG_GAME_SCALE = 4
// window.IG_GAME_CACHE = '' as any
// window.IG_ROOT = `/assets/`
// window.IG_WIDTH = 568
// window.IG_HEIGHT = 320
// // @ts-expect-error
// window.IG_HIDE_DEBUG = false
// // @ts-expect-error
// window.IG_SCREEN_MODE_OVERRIDE = 2
// window.IG_WEB_AUDIO_BGM = false
// window.IG_FORCE_HTML5_AUDIO = false
// window.LOAD_LEVEL_ON_GAME_START = null
// window.IG_GAME_DEBUG = false
// window.IG_GAME_BETA = false

import { Mod, type Modloader } from '../../ccloader/js/mod.js'

import './vfs.js'
import { initVfs } from './vfs.js'
import { resizeFix } from './screen-fix.js'

async function run() {
    await import('../../assets/game/page/game-base.js')
    await import('../../assets/impact/page/js/seedrandom.js')

    const modsDefault = await Promise.all([
        import('../../assets/mods/cc-ts-template-esbuild/plugin.js'),
    ])
    const modloader = {
        fileManager: {},
    } as Modloader
    const mods: Mod[] = []
    for (const def of modsDefault) {
        const mod = new Mod(modloader)
        mods.push(mod)

        const clazz = def.default
        const plugin = new clazz(mod)
        mod.pluginInstance = plugin as any
    }
    for (const mod of mods) await mod.loadPreload()

    {
        const back = window.Worker
        // @ts-expect-error
        window.Worker = function () {}

        // @ts-expect-error
        await import('../../assets/js/game.compiled.js')

        window.Worker = back
    }
    resizeFix()

    await initVfs()

    let waitForGameResolve: () => void
    let waitForGamePromise = new Promise<void>(res => (waitForGameResolve = res))
    ig.Loader.inject({
        finalize() {
            let end = ig.resources.length > 0
            this.parent()
            if (end && ig.ready) {
                waitForGameResolve()
            }
        },
    })

    window.onload = async () => {
        for (const mod of mods) await mod.loadPrestart()

        startCrossCode()

        await waitForGamePromise
        for (const mod of mods) await mod.loadPostload()
        for (const mod of mods) await mod.load()
    }
}
run()
