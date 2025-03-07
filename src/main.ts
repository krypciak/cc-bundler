import * as semver from 'semver'

declare global {
    interface Window {
        global: Window
        semver: typeof import('semver')
    }
}

window.global = window
window.semver = semver

await import('')
