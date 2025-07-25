import { fs } from './fs-proxy'

import path from 'path-browserify'
export { path }

// @ts-expect-error
import util from '@jspm/core/nodelibs/util'

// @ts-expect-error
import assert from '@jspm/core/nodelibs/assert'

// @ts-expect-error
import events from '@jspm/core/nodelibs/events'

const crypto = {}
const stream = {}
const http = {}
const https = {}

const nwGui = {
    App: {
        dataPath: '/nwjsData',
        argv: [],
    } satisfies Partial<nw.App> as unknown as nw.App,
    Window: {
        get(): NWJS_Helpers.win {
            return {
                isFullscreen: false,
                enterFullscreen() {
                    document.body.requestFullscreen()
                },
                leaveFullscreen() {
                    document.exitFullscreen()
                },
                close() {
                    location.reload()
                },
            } as NWJS_Helpers.win
        },
        async open(url: string, _option: NWJS_Helpers.WindowOpenOption) {
            if (url.startsWith('data:image/png;base64,')) {
                /* workaround because of https://blog.mozilla.org/security/2017/11/27/blocking-top-level-navigations-data-urls-firefox-59/ */
                const blob = await (await fetch(url)).blob()
                const fileURL = URL.createObjectURL(blob)
                window.open(fileURL, '_blank')
            } else {
                window.open(url, '_blank')
            }
        },
    } satisfies Partial<nw.Window> as unknown as nw.Window,
    Clipboard: {
        get() {
            return {
                async set(_content: string, _type: string, _raw: boolean) {},
                get(_type, _raw) {
                    return 'not supported'
                },
            } satisfies Partial<NWJS_Helpers.clip> as unknown as NWJS_Helpers.clip
        },
    } satisfies Partial<nw.Clipboard> as unknown as nw.Clipboard,
} as const satisfies Partial<typeof nw>
window.nw = nwGui as typeof nw

const greenworks = {
    init() {},
    activateAchievement() {
        // console.log('activateAchievement', ...args)
    },
    clearAchievement() {
        // console.log('clearAchievement', ...args)
    },
}

export function requireFix() {
    // @ts-expect-error
    window.require = (src: string) => {
        if (src == 'fs') return fs
        if (src == 'path') return path
        if (src == 'http') return http
        if (src == 'https') return https
        if (src == 'crypto') return crypto
        if (src == 'stream') return stream
        if (src == 'util') return util
        if (src == 'nw.gui') return nwGui
        if (src == 'events') return events
        if (src == 'assert') return assert
        if (src.includes('greenworks')) return greenworks

        console.groupCollapsed(`requireFix: unknown module: ${src}`)
        console.trace()
        console.groupEnd()
    }
}

window.ccbundler = true

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
    versions: {
        nw: '100.0.0',
        'node-webkit': '100.0.0',
    },
    env: {},
    cwd() {
        return '/'
    },
} as any

window.chrome ??= {}
window.chrome.runtime = {
    reload() {
        location.reload()
    },
}
