import { loadServiceWorker } from '../../ccloader3/packages/core/src/service-worker-bridge'
import { getInternalFileList, preloadInit } from './fs/fs-proxy'
import { requireFix } from './nwjs-fix'
import { initLoadScreen } from './ui'
import { checkAutorun } from './autorun'
import { checkPWA } from './pwa'
import './localstoarge-default'
import type { VersionResp } from './service-worker/offline-cache-proxy'
import { copyFiles } from './upload-processing'
import { initOpfsProxyBridge } from './opfs-proxy-bridge'
import { updateLiveMods } from './live-mods'

const runtimeModsDirtyKey = 'cc-bundler-runtime-mods-dirty'

async function setup() {
    // trigger service worker update check
    fetch('/version').then(async resp => {
        const data: VersionResp = await resp.json()
        if (data.updated && data.previousVersion != undefined) {
            localStorage[runtimeModsDirtyKey] = 'true'
            location.reload()
        }
    })

    if (!navigator.serviceWorker) {
        storageInfoLabel.innerHTML =
            'Service Workers not supported! <br> Cannot continue <br> (Make sure you connect with https!)'
        return
    }
    if (!navigator.storage) {
        storageInfoLabel.innerHTML = 'Storage API not supported! <br> Cannot continue'
        return
    }

    await loadServiceWorker()
    initOpfsProxyBridge()

    if (navigator.serviceWorker.controller) {
        initLoadScreen()
        requireFix()

        await preloadInit()

        if (checkAutorun()) return

        checkPWA()
    }
}
setup()

export async function run() {
    if (localStorage[runtimeModsDirtyKey] == 'true') {
        await copyFiles(await getInternalFileList(), false)
        localStorage[runtimeModsDirtyKey] = 'false'
    }

    await updateLiveMods()

    bundleTitleScreen.style.display = 'none'

    const modloader = await import('../../ccloader3/packages/core/src/modloader')
    await modloader.boot()
}
