import type { Dirent, MakeDirectoryOptions, ObjectEncodingOptions, StatOptions, Stats } from 'fs'

import { dirname, basename } from 'path-browserify'
import { OpfsDirent, OpfsStats, constants } from './fs-misc'

export async function getUint8ArrayFromFile(file: File): Promise<Uint8Array> {
    if (file.bytes) {
        return file.bytes()
    } else {
        return new Uint8Array(await file.arrayBuffer())
    }
}

let fsRoot: FileSystemDirectoryHandle

export async function init() {
    fsRoot = await navigator.storage.getDirectory()
    await buildQuickPathLookupMap()
}

const pathToFileHandle: Map<string, FileSystemFileHandle> = new Map()
const pathToDirHandle: Map<string, FileSystemDirectoryHandle> = new Map()

function cleanPath(path: string): string {
    if (path.startsWith('.')) path = path.substring(1)
    if (path.startsWith('/')) path = path.substring(1)
    if (path.endsWith('/')) path = path.slice(0, -1)
    return path
}

function getFileHandle(path: string): FileSystemFileHandle | undefined {
    return pathToFileHandle.get(path)
}

function getDirHandle(path: string): FileSystemDirectoryHandle | undefined {
    return pathToDirHandle.get(path)
}

async function forEach(
    dir: FileSystemDirectoryHandle,
    fileFunc: (file: FileSystemFileHandle, path: string) => void,
    dirFunc: (dir: FileSystemDirectoryHandle, path: string) => void,
    path = ''
) {
    for await (const [name, handle] of dir.entries()) {
        const newPath = path + name
        if (handle.kind == 'file') {
            const handle = await dir.getFileHandle(name)
            fileFunc(handle, newPath)
        } else if (handle.kind == 'directory') {
            const handle = await dir.getDirectoryHandle(name)
            dirFunc(handle, newPath)

            await forEach(handle, fileFunc, dirFunc, newPath + '/')
        }
    }
}

async function buildQuickPathLookupMap() {
    pathToDirHandle.set('', fsRoot)
    await forEach(
        fsRoot,
        (file, path) => {
            pathToFileHandle.set(path, file)
        },
        (dir, path) => {
            pathToDirHandle.set(path, dir)
        }
    )
}

function getParentDirHandle(path: string) {
    const parent = cleanPath(dirname(path))

    const parentHandle = getDirHandle(parent)
    if (!parentHandle) throw new Error(`opfs: directory parent doesn't exist: ${path}`)

    return parentHandle
}

async function touch(path: string): Promise<FileSystemFileHandle> {
    let handle = getFileHandle(path)
    if (handle) return handle

    const dir = getParentDirHandle(path)

    const fileName = basename(path)
    handle = await dir.getFileHandle(fileName, { create: true })
    pathToFileHandle.set(path, handle)

    return handle
}

async function readFile(path: string, encoding: 'utf-8' | 'utf8'): Promise<string>
async function readFile(path: string, encoding?: string): Promise<Uint8Array>
async function readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    path = cleanPath(path)
    const handle = getFileHandle(path)
    if (!handle) throw new Error(`opfs: file not found: ${path}`)

    const file = await handle.getFile()

    if (encoding == 'utf-8' || encoding == 'utf8') {
        return file.text()
    } else {
        return getUint8ArrayFromFile(file)
    }
}

async function writeFile(
    path: string,
    data: string | NodeJS.ArrayBufferView,
    options?: ObjectEncodingOptions | BufferEncoding | null
): Promise<void> {
    path = cleanPath(path)
    const handle = await touch(path)
    const writeable = await handle.createWritable()

    const encoding =
        typeof data == 'string' && !options
            ? 'utf8'
            : ((typeof options == 'string' ? options : options?.encoding) ?? 'binary')

    if (encoding != 'utf8' && encoding != 'utf-8' && encoding != 'binary') {
        console.error('options:', options)
        throw new Error(`opfs: writeFile encoding not implemented: ${encoding}`)
    }
    await writeable.write(data)
    await writeable.close()
}

function readdir(
    path: string,
    options?:
        | (ObjectEncodingOptions & {
              withFileTypes?: false | undefined
              recursive?: boolean | undefined
          })
        | BufferEncoding
        | null
): Promise<string[]>
function readdir(
    path: string,
    options: ObjectEncodingOptions & {
        withFileTypes: true
        recursive?: boolean | undefined
    }
): Promise<Dirent[]>
async function readdir(
    path: string,
    options?:
        | (ObjectEncodingOptions & {
              withFileTypes?: boolean
              recursive?: boolean
          })
        | BufferEncoding
        | null
): Promise<string[] | Dirent[]> {
    path = cleanPath(path)
    const handle = getDirHandle(path)
    if (!handle) throw new Error(`opfs: directory not found: ${path}`)

    const recursive = typeof options == 'object' && options?.recursive
    const withFileTypes = typeof options == 'object' && options?.withFileTypes

    function entriesToDirents(entries: [string, FileSystemHandle][]): OpfsDirent[] {
        return entries.map(([name, file]) => new OpfsDirent(file.kind == 'file', name, path + '/' + name, path))
    }

    if (recursive) {
        if (withFileTypes) {
            const files: [string, FileSystemHandle][] = []
            await forEach(
                handle,
                (file, path) => files.push([path, file]),
                (dir, path) => files.push([path, dir])
            )
            return entriesToDirents(files)
        } else {
            const result: string[] = []
            await forEach(
                handle,
                (_file, path) => result.push(path),
                (_dir, path) => result.push(path)
            )
            return result
        }
    } else {
        if (withFileTypes) {
            return entriesToDirents(await Array.fromAsync(handle.entries()))
        } else {
            return Array.fromAsync(handle.keys())
        }
    }
}

async function exists(path: string): Promise<boolean> {
    path = cleanPath(path)
    return !!(getFileHandle(path) || getDirHandle(path))
}

async function touchDir(path: string): Promise<FileSystemDirectoryHandle> {
    const parentHandle = getParentDirHandle(path)
    const dirName = basename(path)
    const handle = await parentHandle.getDirectoryHandle(dirName, { create: true })
    pathToDirHandle.set(path, handle)
    return handle
}

function mkdir(
    path: string,
    options: {
        recursive: true
    }
): Promise<string | undefined>
function mkdir(
    path: string,
    options?: {
        recursive?: false
    } | null
): Promise<void>
async function mkdir(path: string, options?: MakeDirectoryOptions | null): Promise<string | void> {
    path = cleanPath(path)
    const recursive = typeof options == 'object' && options?.recursive

    if (recursive) {
        const sp = path.split('/')
        let firstCreated: string | undefined
        let currPath = ''
        for (let i = 0; i < sp.length; i++) {
            const newPath = i == 0 ? sp[i] : currPath + '/' + sp[i]
            if (!getDirHandle(newPath)) {
                firstCreated ??= newPath
                await touchDir(newPath)
            }
            currPath = newPath
        }

        return firstCreated
    } else {
        if (getDirHandle(path)) throw new Error(`opfs: directory already exists: ${path}`)

        await touchDir(path)
    }
}

async function access(path: string, _mode?: number): Promise<void> {
    if (!(await exists(path))) throw new Error(`opfs: access error (file doesn't exist): ${path}`)
    return
}

function stat(
    path: string,
    opts?: StatOptions & {
        bigint?: false | undefined
    }
): Promise<Stats>
// function stat(
//     path: string,
//     opts: StatOptions & {
//         bigint: true
//     }
// ): Promise<BigIntStats>
async function stat(path: string, opts?: StatOptions): Promise<Stats> {
    path = cleanPath(path)
    const handle = getFileHandle(path) || getDirHandle(path)
    if (!handle) throw new Error(`opfs: stat file or directory not found: ${path}`)

    if (opts?.bigint) throw new Error('opfs: stat bigint option not implemented')

    return new OpfsStats(handle.kind == 'file')
}

// stat

function wrapAsync<D, CB = (err: Error | null, data: D | null) => void>(
    func: (path: string, options?: any) => Promise<D>
) {
    return async (path: string, optionsOrCb: unknown | CB, cb?: (err: Error | null, data: D | null) => void) => {
        const callback = (typeof optionsOrCb == 'function' ? optionsOrCb : cb) as (a: unknown, b: unknown) => void
        const options = typeof optionsOrCb == 'function' ? undefined : (optionsOrCb as any)
        func(path, options)
            .then(data => callback(null, data))
            .catch(err => callback(err, null))
    }
}

export const fs = {
    constants,
    promises: {
        readFile,
        writeFile,
        readdir,
        exists,
        mkdir,
        access,
        stat,
    },
    readFile: wrapAsync(readFile),
    readdir: wrapAsync(readdir),
    fileCount() {
        return pathToFileHandle.size
    },
    dirCount() {
        return pathToDirHandle.size
    },
}

// const fsa: typeof import('fs') = undefined as any
// fsa.promises.stat()
