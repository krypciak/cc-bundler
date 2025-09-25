import './mod-download-proxy'
import './ccmod-proxy'
import './opfs-proxy'
// import './offline-cache-proxy'

self.addEventListener('activate', () => {
    void self.clients.claim()
})

self.addEventListener('install', () => {
    void self.skipWaiting()
})
