import * as fsProxy from './fs-proxy'
import { requireFix } from './nwjs-fix'
import { audioWarningFix } from './audio-warning-fix'
import { initLoadScreen } from './ui'
import './localstoarge-default'

import { addFetchHandler } from '../../ccloader3/packages/core/src/service-worker-bridge'
import { checkAutorun } from './autorun'

async function setup() {
    if (navigator.serviceWorker.controller) {
        initLoadScreen()
        requireFix()

        await fsProxy.preloadInit()

        checkAutorun()
    } else {
        run()
    }
}
setup()

export async function run() {
    addFetchHandler(['assets', 'ccloader3'], path => {
        return fsProxy.fs.promises.readFile(path)
    })

    const modloader = await import('../../ccloader3/packages/core/src/modloader')
    await modloader.boot()

    audioWarningFix()
}
