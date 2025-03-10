import type { DataRef, IFsProxy, NodeDir, VfsNode, VfsTree } from './fs-proxy'
import { isDir, isFile, isRef } from './fs-proxy'
import type { Dirent } from 'fs'
import * as gzip from './compress'
import 'core-js/actual/typed-array/to-base64'

let vfs!: VfsTree
let dataRef!: DataRef
function initVfsData() {
    // @ts-expect-error
    vfs = VFS_DATA
    // @ts-expect-error
    // prettier-ignore
    dataRef = [REF_DATA_0, REF_DATA_1, REF_DATA_2, REF_DATA_3, REF_DATA_4, REF_DATA_5, REF_DATA_6, REF_DATA_7, REF_DATA_8, REF_DATA_9, REF_DATA_10, REF_DATA_11, REF_DATA_12, REF_DATA_13, REF_DATA_14, ]
}

function preparePath(path: string): string {
    path = path.trim()
    if (path.startsWith('./')) path = path.substring('./'.length)
    if (path.startsWith('/')) path = path.substring('/'.length)
    if (path.startsWith('assets/')) path = path.substring('assets/'.length)
    let last = ''
    let newPath = []
    for (const c of path) {
        if (last == '/' && c == '/') continue
        last = c
        newPath.push(c)
    }
    return newPath.join('')
}
export function resolvePath(path: string, root = vfs): VfsNode {
    path = preparePath(path)
    const sp = path.split('/')
    let obj = root
    for (let i = 0; i < sp.length - 1; i++) {
        const next = obj[sp[i]]
        if (!next || !isDir(next)) throw new Error(`vfs: No such directory: ${path}`)
        obj = next
    }
    const ret = obj[sp[sp.length - 1]]
    if (!ret) throw new Error(`vfs: No such file or directory: ${path}`)
    return ret
}

function doesFileExist(path: string): boolean {
    try {
        resolvePath(path)
        return true
    } catch (e) {
        return false
    }
}

async function base64ToBufferAsync(base64: string) {
    var dataUrl = 'data:application/octet-binary;base64,' + base64

    const buf = await fetch(dataUrl).then(res => res.arrayBuffer())
    return new Uint8Array(buf)
}

async function readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>
async function readFile(path: string, encoding?: string): Promise<Uint8Array>
async function readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const node = resolvePath(path)
    let compressedStr
    if (isFile(node)) {
        compressedStr = node.c
    } else if (isRef(node)) {
        compressedStr = dataRef[node.fi][node.i]
    } else throw new Error(`vfs: Not a file: ${path}`)

    const compressedBuf = await base64ToBufferAsync(compressedStr)
    let ret
    if (encoding == 'utf-8' || encoding == 'utf8') ret = await gzip.decompressToString(compressedBuf)
    else ret = await gzip.decompressToChunks(compressedBuf)

    return ret
}

class VfsDirent {
    node: VfsNode
    name: string
    constructor(node1: VfsNode, name1: string) {
        this.node = node1
        this.name = name1
    }

    isDirectory() {
        return this.node.t == 'd'
    }
    isFile() {
        return this.node.t == 'f'
    }
}
// @ts-expect-error
async function readdir(path: string, options: { withFileTypes: true; recursive?: boolean }): Promise<Dirent[]>
async function readdir(path: string, options?: { withFileTypes?: false; recursive?: boolean }): Promise<string[]>
async function readdir(path: string, options: { withFileTypes?: false; recursive?: boolean } = {}): Promise<string[] | Dirent[]> {
    if (options.recursive) throw new Error(`vfs: readdir: unsupported option: recursive`)

    const node = resolvePath(path)
    if (!isDir(node)) throw new Error(`vfs: Not a directory: ${path}`)
    if (options.withFileTypes) {
        const arr: Dirent[] = []
        for (const [name, child] of Object.entries(node)) {
            if (name == 't') continue
            arr.push(new VfsDirent(child, name) as unknown as Dirent)
        }
        return arr
    } else return Object.keys(node).filter(a => a != 't')
}

// @ts-expect-error
async function mkdir(path: string, options: { recursive: true }): Promise<string | undefined>
async function mkdir(path: string, options?: { recursive?: false }): Promise<void>
async function mkdir(path: string, options: { recursive?: boolean } = {}) {
    path = preparePath(path)
    const sp = path.split('/')
    let obj = vfs
    for (let i = 0; i < sp.length; i++) {
        let next = obj[sp[i]]
        if (!next) {
            if (options.recursive) {
                next = obj[sp[i]] = {
                    t: 'd',
                } as NodeDir
            } else throw new Error(`vfs: mkdir: cannot make a directory, parent doesn't exist: ${path} (consider options.recursive)`)
        } else if (!isDir(next)) throw new Error(`vfs: mkdir: cannot make a directory, a file exists: ${path}`)
        obj = next as VfsTree
    }
}

async function stat(path: string, _opts?: {}): Promise<VfsDirent> {
    const node = resolvePath(path)
    return new VfsDirent(node, '')
}

async function access(path: string, _mode?: number): Promise<void> {
    // just throw if the path doesnt exist
    resolvePath(path)
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
                data = await readdir('extension')
                data = data.filter(dir => dir != 'readme.txt')
            } else {
                if (!doesFileExist(settings.url)) {
                    if (settings.error) {
                        settings.error.call(settings.context, undefined as any, undefined as any, undefined as any)
                    }
                    return
                }
                const dataStr: string = await fs.promises.readFile(settings.url, 'utf-8')

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

            if (!doesFileExist(this.path)) {
                if (this.onerror) this.onerror()
                return
            }
            fs.promises.readFile(this.path).then(data => {
                // @ts-expect-error
                const base64 = data.toBase64()
                const src = 'data:image/png;base64,' + base64
                this.data.src = src
            })
        },
    })
}

function initAudio() {
    const orig = window.Audio
    window.Audio = function (src?: string) {
        const obj = new orig()
        if (src) {
            if (!doesFileExist(src)) src = 'empty.ogg'
            fs.promises.readFile(src).then(data => {
                // @ts-expect-error
                const base64 = data.toBase64()
                obj.src = 'data:audio/ogg;base64,' + base64
            })
        }
        return obj
    } as any
}
function initXml() {
    class MyXmlHttpRequest {
        readonly UNSENT = 0
        readonly OPENED = 1
        readonly HEADERS_RECEIVED = 2
        readonly LOADING = 3
        readonly DONE = 4

        readyState: number = 0
        responseType?: XMLHttpRequestResponseType
        response: any
        status?: number
        onreadystatechange?: ((this: XMLHttpRequest, ev: Event) => any) | null
        onload?: () => void
        onerror?: () => void

        private url?: string

        constructor() {}
        open(_method: string, url: string | URL): void {
            if (typeof url !== 'string') throw new Error(`vfs: XmlHttpRequest: unsuppoted url type: ${typeof url}`)
            this.url = url
        }
        send(_body?: Document | XMLHttpRequestBodyInit | null): void {
            if (!this.url) throw new Error(`vfs: XmlHttpRequest: send called before open`)
            if (!doesFileExist(this.url)) {
                if (this.onerror) this.onerror()
                return
            }
            fs.promises.readFile(this.url).then(data => {
                if (this.responseType == 'arraybuffer') {
                    this.response = data.buffer
                    this.readyState = 200
                    if (this.onload) this.onload()
                } else throw new Error(`vfs: XmlHttpRequest: unsupported responseType: ${this.responseType}`)
            })
        }
        setRequestHeader(_name: string, _value: string): void {}
        addEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions): void {}
    }
    // @ts-expect-error
    window.XMLHttpRequest = MyXmlHttpRequest
}

const FsProxy = {
    preGameInit: async () => {
        initVfsData()
        initAjax()
        initAudio()
        initXml()
    },
    init: async () => {
        initIgImage()

        // @ts-expect-error
        window.vfs = {
            vfs,
            dataRef,
        }
    },
    fs: {
        promises: {
            // @ts-expect-error
            readFile,
            // @ts-expect-error
            readdir,
            // @ts-expect-error
            mkdir,
            // @ts-expect-error
            stat,
            // @ts-expect-error
            access,
        },
    },
} satisfies IFsProxy
const fs = FsProxy.fs

export default FsProxy
