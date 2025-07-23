import $ from 'jquery'

// @ts-expect-error
window.$ = $

/* Set variables from assets/node-webkit.html */
window.IG_GAME_SCALE = 4

import './localstoarge-default'
import { requireFix } from './require-fix'
import * as fsProxy from './fs-proxy'
import { audioWarningFix } from './audio-warning-fix.js'

import { addFetchHandler } from '../../ccloader3/packages/core/src/service-worker-bridge.js'
import { showLoadScreen } from './ui.js'

declare global {
    var ccbundler: boolean
}

async function setup() {
    if (navigator.serviceWorker.controller) {
        showLoadScreen()
        requireFix()

        await fsProxy.preloadInit()
    } else {
        run()
    }
}
setup()

export async function run() {
    addFetchHandler(['assets', 'dist'], async path => {
        return (await fsProxy.fs.promises.readFile(path)).buffer
    })

    const modloader = await import('../../ccloader3/packages/core/src/modloader.js')
    await modloader.boot()

    audioWarningFix()
}
