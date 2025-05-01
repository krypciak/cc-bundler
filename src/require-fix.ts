import { path } from './fs-proxy'

export const http = {}
export const https = {}

export function requireFix() {
    // @ts-expect-error
    window.require = (src: string) => {
        if (src == 'fs') return fsProxy.fs
        if (src == 'path') return path
        if (src == 'http') return http
        if (src == 'https') return https
        console.warn(`requireFix: unknown module: ${src}`)
    }
}
