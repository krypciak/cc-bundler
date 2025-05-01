import type { IFsProxy } from './fs-proxy'

export interface VfsTree {
    [name: string]: VfsNode
}
export type DataRef = string[][]

export type NodeDir = { t: 'd' } & VfsTree
export type NodeFile = { t: 'f'; c: string }
export type NodeRef = { t: 'r'; fi: number; i: number }
export type VfsNode = NodeDir | NodeFile | NodeRef

export function isFile(node: VfsNode): node is NodeFile {
    return node.t == 'f'
}
export function isDir(node: VfsNode): node is NodeDir {
    return node.t == 'd'
}
export function isRef(node: VfsNode): node is NodeRef {
    return node.t == 'r'
}

import type { Dirent } from 'fs'
import * as gzip from './compress'

let vfs: VfsTree = {}
let dataRef: DataRef = []
function initVfsData() {
    // @ts-expect-error
    vfs = VFS_DATA
    // @ts-expect-error
    // prettier-ignore
    dataRef = [REF_DATA_0, REF_DATA_1, REF_DATA_2, REF_DATA_3, REF_DATA_4, REF_DATA_5, REF_DATA_6, REF_DATA_7, REF_DATA_8, REF_DATA_9, REF_DATA_10, REF_DATA_11, REF_DATA_12, REF_DATA_13, REF_DATA_14, ]
}

export function preparePath(path: string): string {
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

async function doesFileExist(path: string): Promise<boolean> {
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

export async function uncompressData(compressedStr: string, encoding?: string) {
    const compressedBuf = await base64ToBufferAsync(compressedStr)
    if (encoding == 'utf-8' || encoding == 'utf8') return gzip.decompressToString(compressedBuf)
    else return gzip.decompressToChunks(compressedBuf)
}

async function readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>
async function readFile(path: string, encoding?: string): Promise<Uint8Array>
async function readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const node = resolvePath(path)
    let compressedStr
    if (isFile(node)) {
        throw new Error('nuh uh')
        // compressedStr = node.c
    } else if (isRef(node)) {
        compressedStr = dataRef[node.fi][node.i]
    } else throw new Error(`vfs: Not a file: ${path}`)

    return uncompressData(compressedStr, encoding)
}

class VfsDirent {
    node: VfsNode
    name: string
    constructor(node1: VfsNode, name1: string) {
        this.node = node1
        this.name = name1
    }

    isDirectory() {
        return isDir(this.node)
    }
    isFile() {
        return isRef(this.node)
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

export async function forEachNode(
    tree: VfsTree,
    func: (node: VfsNode, fileName: string, path: string) => Promise<void> | void,
    path: string = '',
    promises: Promise<void>[] = []
) {
    for (const key in tree) {
        if (key == 't') continue
        const node = tree[key]
        const npath = path + '/' + key

        const promise = func(node, key, npath)
        if (promise) promises.push(promise)

        if (isDir(node)) {
            forEachNode(node, func, npath, promises)
        }
    }
    if (path == '') await Promise.all(promises)
}

export const VfsFsProxy = {
    preloadInit: async () => {
        initVfsData()

        // @ts-expect-error
        window.vfs = {
            vfs,
            dataRef,
        }
    },
    init: async () => {},
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

            doesFileExist,
        },
    },
} satisfies IFsProxy
