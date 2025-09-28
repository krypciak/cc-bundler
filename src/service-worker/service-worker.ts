import './keep-alive'
import './ccmod-proxy'
import './opfs-proxy'

declare global {
    const WEB: boolean
}

if (WEB) {
    import('./mod-download-proxy')
    import('./offline-cache-proxy')
} else {
    import('./capacitor-proxy')
}

self.addEventListener('activate', () => {
    void self.clients.claim()
})

self.addEventListener('install', () => {
    void self.skipWaiting()
})
