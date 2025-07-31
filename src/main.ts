import { addFetchHandler } from '../../ccloader3/packages/core/src/service-worker-bridge'
import * as fsProxy from './fs/fs-proxy'
import { requireFix } from './nwjs-fix'
import { initLoadScreen } from './ui'
import { checkAutorun } from './autorun'
import { checkPWA } from './pwa'
import './localstoarge-default'

async function setup() {
    if (!navigator.serviceWorker) {
        storageInfoLabel.innerHTML = 'Service Workers not supported! <br> Cannot continue'
        return
    }
    if (!navigator.storage) {
        storageInfoLabel.innerHTML = 'Storage API not supported! <br> Cannot continue'
        return
    }

    if (navigator.serviceWorker.controller) {
        initLoadScreen()
        requireFix()

        await fsProxy.preloadInit()

        if (checkAutorun()) return

        checkPWA()
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
}
