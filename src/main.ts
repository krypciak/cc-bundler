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

import { resizeFix } from './screen-fix'
import './localstoarge-default'
import * as modloader from './mods'
import { requireFix } from './require-fix'
import * as fsProxy from './fs-proxy'

async function run() {
    await fsProxy.preloadInit()

    await import('../../assets/game/page/game-base.js')
    await import('../../assets/impact/page/js/seedrandom.js')
    // @ts-expect-error
    window.semver = (await import('../../ccloader/js/lib/semver.browser.js')).default
    requireFix()

    await modloader.init()
    await modloader.createPlugins()
    await modloader.runPreload()

    {
        const backupWorker = window.Worker
        // @ts-expect-error
        window.Worker = function () {}

        const backupProcess = window.process
        /* Trick the game into setting ig.platform to ig.PLATFORM_TYPES.BROWSER */
        // @ts-expect-error
        window.process = undefined

        // @ts-ignore
        await import('../../assets/js/game.compiled.js')

        window.Worker = backupWorker
        window.process = backupProcess
    }
    resizeFix()

    await fsProxy.init()

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
        await modloader.runPrestart()

        startCrossCode()

        await waitForGamePromise
        await modloader.runPostload()
        await modloader.runPoststart()
    }
}
run()
