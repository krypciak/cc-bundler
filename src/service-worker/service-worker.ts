import './mod-download-proxy'
import './ccmod-proxy'

self.addEventListener('activate', () => {
    void self.clients.claim()
})

self.addEventListener('install', () => {
    void self.skipWaiting()
})
