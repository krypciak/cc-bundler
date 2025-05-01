import type { Dirent } from 'fs'
import type { IFsProxy } from './fs-proxy'
import { VfsFsProxy } from './vfs'

function preparePath(path: string): string {
    if (path.startsWith('./')) path = path.substring('./'.length)
    if (path.startsWith('/assets')) return path
    if (path.startsWith('assets/')) return path
    if (path.startsWith('/')) return `/assets${path}`
    return `/assets/${path}`
}

async function doesFileExist(path: string) {
    const vfsResult = await VfsFsProxy.fs.promises.doesFileExist(path)
    if (vfsResult) return true

    path = preparePath(path)
    try {
        const resp = await fetch(path)
        return resp.status == 200
    } catch (e) {
        return false
    }
    // return Vfs.fs.promises.doesFileExist(path)
}

async function readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>
async function readFile(path: string, encoding?: string): Promise<Uint8Array>
async function readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    try {
        path = preparePath(path)
        const resp = await fetch(path)

        if (encoding == 'utf-8' || encoding == 'utf8') {
            const text = await resp.text()
            return text
        }
        const buffer = await resp.arrayBuffer()
        return new Uint8Array(buffer)
    } catch (e) {
        return VfsFsProxy.fs.promises.readFile(path, encoding)
    }
}

// @ts-expect-error
async function readdir(path: string, options: { withFileTypes: true; recursive?: boolean }): Promise<Dirent[]>
async function readdir(path: string, options?: { withFileTypes?: false; recursive?: boolean }): Promise<string[]>
async function readdir(path: string, options: { withFileTypes?: false; recursive?: boolean } = {}): Promise<string[] | Dirent[]> {
    return VfsFsProxy.fs.promises.readdir(path, options)
}

async function mkdir(path: string, options: { recursive?: boolean } = {}) {
    return VfsFsProxy.fs.promises.mkdir(path, options as any)
}

async function stat(path: string, _opts?: {}) {
    return VfsFsProxy.fs.promises.stat(path, _opts)
}

async function access(path: string, _mode?: number): Promise<void> {
    return VfsFsProxy.fs.promises.access(path, _mode)
}

export const WebFsProxy = {
    preloadInit: async () => {
        await VfsFsProxy.preloadInit()
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
