import { path } from './fs-proxy'

const http = {}
const https = {}
const crypto = {}
const stream = {}

export function requireFix() {
    // @ts-expect-error
    window.require = (src: string) => {
        if (src == 'fs') return fsProxy.fs
        if (src == 'path') return path
        if (src == 'http') return http
        if (src == 'https') return https
        if (src == 'crypto') return crypto
        if (src == 'stream') return stream
        console.groupCollapsed(`requireFix: unknown module: ${src}`)
        console.trace()
        console.groupEnd()
    }
}
