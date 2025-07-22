import { path, fs } from './fs-proxy'

const http = {}
const https = {}
const crypto = {}
const stream = {}
const util = {
    format(str: string) {
        return str
    },
}
const nwGui = {
    App: {
        dataPath: '/nwjsData',
        argv: [],
    },
    Window: {
        get(): NWJS_Helpers.win {
            return {
                isFullscreen: false,
                enterFullscreen() {},
                leaveFullscreen() {},
                close() {},
            } as NWJS_Helpers.win
        },
        open(url: string, option: NWJS_Helpers.WindowOpenOption) {},
    },
    Clipboard: {
        get() {
            return {
                set(content: string, type: string, das: boolean) {},
            }
        },
    },
}
const greenworks = {
    init() {},
    activateAchievement() {},
    clearAchievement() {},
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

// @ts-expect-error
window.nw = {}

// @ts-expect-error
window.chrome.runtime = {
    reload() {
        location.reload()
    },
}
