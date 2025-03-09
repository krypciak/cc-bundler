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

export interface IFsProxy {
    preGameInit: () => Promise<void>
    init: () => Promise<void>
    fs: {
        promises: {
            readFile: (typeof import('fs/promises'))['readFile']
            readdir: (typeof import('fs/promises'))['readdir']
            mkdir: (typeof import('fs/promises'))['mkdir']
            stat: (typeof import('fs/promises'))['stat']
            access: (typeof import('fs/promises'))['access']
        }
    }
}

export const path = {
    join(a: string, b: string) {
        return a + '/' + b
    },
}
