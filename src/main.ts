import * as fsProxy from './fs-proxy'
import { requireFix } from './nwjs-fix'
import { audioWarningFix } from './audio-warning-fix'
import { showLoadScreen } from './ui'
import './localstoarge-default'

import { addFetchHandler } from '../../ccloader3/packages/core/src/service-worker-bridge'

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
    addFetchHandler(['assets', 'ccloader3'], async path => {
        return (await fsProxy.fs.promises.readFile(path)).buffer
    })

    const modloader = await import('../../ccloader3/packages/core/src/modloader')
    await modloader.boot()

    audioWarningFix()
}
