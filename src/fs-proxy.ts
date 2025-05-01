import 'core-js/actual/typed-array/to-base64'
import { VfsFsProxy } from './vfs'
import { WebFsProxy } from './web-fs'

declare global {
    var fsProxy: IFsProxy
}

export interface IFsProxy {
    preloadInit: () => Promise<void>
    init: () => Promise<void>
    fs: {
        promises: {
            readFile: (typeof import('fs/promises'))['readFile']
            readdir: (typeof import('fs/promises'))['readdir']
            mkdir: (typeof import('fs/promises'))['mkdir']
            stat: (typeof import('fs/promises'))['stat']
            access: (typeof import('fs/promises'))['access']

            doesFileExist: (path: string) => Promise<boolean>
        }
    }
}

function initAjax() {
    $.ajax = (settings?: JQuery.AjaxSettings | string): JQuery.jqXHR => {
        if (!settings) throw new Error(`vfs: $.ajax: settings not set`)
        if (typeof settings == 'string') throw new Error(`vfs: $.ajax: unsupported argument (string)`)
        ;(async () => {
            if (!settings.url) throw new Error(`vfs: $.ajax: settings.url not set`)
            if (!settings.success) throw new Error(`vfs: $.ajax: settings.success not set, what are you doing??`)
            if (typeof settings.success != 'function') throw new Error(`vfs: $.ajax: unsupported settings.success type: ${typeof settings.error}`)
            if (typeof settings.error != 'function') throw new Error(`vfs: $.ajax: unsupported settings.error type: ${typeof settings.error}`)

            let data
            if (settings.url == ig.root + 'page/api/get-extension-list.php?debug=' + (window.IG_GAME_DEBUG ? 1 : 0)) {
                data = await fsProxy.fs.promises.readdir('extension')
                data = data.filter(dir => dir != 'readme.txt')
            } else {
                if (!(await fsProxy.fs.promises.doesFileExist(settings.url))) {
                    if (settings.error) {
                        settings.error.call(settings.context, undefined as any, undefined as any, undefined as any)
                    }
                    return
                }
                const dataStr: string = await fsProxy.fs.promises.readFile(settings.url, 'utf-8')

                if (settings.dataType == 'json') {
                    data = JSON.parse(dataStr)
                } else throw new Error(`vfs: $.ajax: unsupported settings.dataType: ${settings.dataType}`)
            }
            settings.success.call(settings.context, data, undefined as any, undefined as any)
        })()
        return undefined as any
    }
}

function initIgImage() {
    ig.Image.inject({
        loadInternal() {
            this.data = new Image()
            this.data.onload = this.onload.bind(this)
            this.data.onerror = this.onerror.bind(this)
            ;(async () => {
                if (!fsProxy.fs.promises.doesFileExist(this.path)) {
                    if (this.onerror) this.onerror()
                    return
                }
                const data = await fsProxy.fs.promises.readFile(this.path)
                // @ts-expect-error
                const base64 = data.toBase64()
                const src = 'data:image/png;base64,' + base64
                this.data.src = src
            })()
        },
    })
}

function initAudio() {
    const orig = window.Audio
    window.Audio = function (src?: string) {
        const obj = new orig()
        if (src) {
            ;(async () => {
                if (!(await fsProxy.fs.promises.doesFileExist(src))) src = 'empty.ogg'

                const data = await fsProxy.fs.promises.readFile(src!)
                // @ts-expect-error
                const base64 = data.toBase64()
                obj.src = 'data:audio/ogg;base64,' + base64
            })()
        }
        return obj
    } as any
}

function fixWebAudio() {
    function preparePath(path: string) {
        path = `${ig.root + path.match(/^(.*)\.[^\.]+$/)![1]}.${ig.soundManager.format.ext}${ig.getCacheSuffix()}`
        return ig.getFilePath(path)
    }

    ig.SoundManager.inject({
        loadWebAudio(path, loadCallback) {
            // ig.SOUND_ENABLE_LOG && ig.log(`%cREQUEST%c: ${e}`, 'color:#FF0080', '')
            if (this.buffers[path]) {
                loadCallback && loadCallback(path, true)
                return this.buffers[path]
            }
            ;(async () => {
                const filePath = preparePath(path)

                if (!(await fsProxy.fs.promises.doesFileExist(filePath))) {
                    ig.system.error(Error(`Web Audio Load Error: Could not LOAD: ${path}`))
                }
                const data = await fsProxy.fs.promises.readFile(filePath)

                // @ts-expect-error
                ig.soundManager.context.decodeAudioData(
                    data.buffer,
                    (audioBuffer: AudioBuffer) => {
                        // ig.SOUND_ENABLE_LOG && ig.log(`%cDECODED%c: ${e}`, 'color:#800080', '')
                        if (audioBuffer) {
                            // b++
                            ig.soundManager.buffers[path] = audioBuffer
                            loadCallback && loadCallback(path, true)
                        } else {
                            ig.system.error(Error(`Web Audio Load Error: Decoded but NULL ${path}`))
                        }
                    },
                    () => {
                        ig.system.error(Error(`Web Audio Load Error: Could not DECODE: ${path}`))
                    }
                )
            })()
        },
    })
}

declare global {
    var CHOSEN_FS_PROXY: string
}
export async function preloadInit() {
    if (window.CHOSEN_FS_PROXY == 'vfs') {
        window.fsProxy = VfsFsProxy as any
    } else if (window.CHOSEN_FS_PROXY == 'webfs') {
        window.fsProxy = WebFsProxy as any
    } else throw new Error('invalid fs choice')

    initAjax()
    initAudio()
    await fsProxy.preloadInit()
}

export async function init() {
    initIgImage()
    fixWebAudio()
    await fsProxy.init()
}

export const path = {
    join(a: string, b: string) {
        return a + '/' + b
    },
}
