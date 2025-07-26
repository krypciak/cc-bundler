import { isMounted, clearStorage, fs, ccloaderVersion } from './fs-proxy'
import { run } from './main'
import { uploadCrossCode } from './upload-processing'
import type { ChangelogFileData } from 'ultimate-crosscode-typedefs/file-types/changelog'

declare global {
    const bundleTitleScreen: HTMLDivElement

    const storageInfoLabel: HTMLDivElement
    const uploadStatusLabel: HTMLDivElement
    const ccloaderInfoLabel: HTMLDivElement

    const dirInputButton: HTMLButtonElement
    const archiveInputButton: HTMLButtonElement

    const dirInput: HTMLInputElement
    const archiveInput: HTMLInputElement

    const clearButton: HTMLButtonElement
    const runButton: HTMLButtonElement
}

let isClearing = false
let isUploading = false

function updateElementsEnabled() {
    dirInput.disabled = dirInputButton.disabled = !isMounted || isClearing || isUploading
    archiveInput.disabled = archiveInputButton.disabled = !isMounted || isClearing || isUploading
}

async function loadVersion(): Promise<string | undefined> {
    let changelogText: string
    const changelogPath = '/assets/data/changelog.json'
    if (!(await fs.promises.exists(changelogPath))) return

    changelogText = await fs.promises.readFile(changelogPath, 'utf8')

    const { changelog } = JSON.parse(changelogText) as ChangelogFileData
    const latestEntry = changelog[0]

    const version = latestEntry.version

    let hotfix = 0
    let changes = []
    if (latestEntry.changes != null) changes.push(...latestEntry.changes)
    if (latestEntry.fixes != null) changes.push(...latestEntry.fixes)
    for (let change of changes) {
        let match = /^\W*HOTFIX\((\d+)\)/i.exec(change)
        if (match != null && match.length === 2) {
            hotfix = Math.max(hotfix, parseInt(match[1], 10))
        }
    }

    return `v${version}-${hotfix}`
}

async function updateCCLoaderInfo() {
    let gameVersionStr = 'loading...'
    let ccloaderVersionStr = 'loading...'

    if (isMounted) {
        ccloaderInfoLabel.style.visibility = 'inherit'

        const gameVersion = await loadVersion()
        runButton.disabled = !gameVersion
        gameVersionStr = gameVersion ?? 'not installed'

        ccloaderVersionStr = ccloaderVersion!
    } else {
        ccloaderInfoLabel.style.visibility = 'hidden'
    }

    ccloaderInfoLabel.innerHTML = `CrossCode: ${gameVersionStr}<br />CCLoader: ${ccloaderVersionStr}`
}

export async function updateUI() {
    bundleTitleScreen.style.display = 'unset'

    updateStorageInfoLabel()
    updateCCLoaderInfo()
    updateElementsEnabled()

    if (isClearing) {
        clearButton.innerHTML = 'Clearing...'
    } else {
        clearButton.innerHTML = 'Clear storage'
    }
}

export async function updateStorageInfoLabel(mountedCount?: number) {
    if (isMounted) {
        let fileCountStr: string = '???'
        try {
            const count = fs.fileCount() - 1
            fileCountStr = count.toString()
        } catch (e) {}

        const stats = await fs.usage()
        const mbUsed = (stats.usage ?? 0) / 1000 / 1000
        const gbUsed = mbUsed / 1000
        const usedText = (gbUsed >= 1 ? `${gbUsed.toFixed(1)} GB` : `${Math.floor(mbUsed)} MB`) + ' used'

        const gbAvail = (stats.quota ?? 0) / 1000 / 1000 / 1000
        const availText = `${Math.floor(gbAvail)} GB quota`

        storageInfoLabel.innerHTML = `${usedText} / ${availText} <br> Files: ${fileCountStr}`

        clearButton.disabled = mbUsed < 1
    } else {
        if (mountedCount) {
            storageInfoLabel.innerHTML = `Mounting... ${mountedCount ?? ''}<br /> <wbr />`
        }
        clearButton.disabled = false
    }
}

export async function updateUploadStatusLabel(operation: string, fileCount?: number, allFilesCount?: number) {
    const getText = () => {
        if (isClearing) return ''

        if (allFilesCount === undefined) {
            if (fileCount === undefined) {
                return operation
            } else {
                return `${operation}: ${fileCount}`
            }
        } else {
            const percentage = allFilesCount == 0 ? 100 : Math.floor((fileCount! / allFilesCount) * 100)
            return `${operation}: ${fileCount} / ${allFilesCount} (${percentage}%)`
        }
    }
    uploadStatusLabel.textContent = getText()
}

async function onClearStorageClick() {
    isClearing = true
    updateUI()
    await clearStorage()
    isClearing = false
    updateUI()
    clearButton.innerHTML = 'Cleared!'
}

async function onUpload(files: FileList) {
    isUploading = true
    await uploadCrossCode(files)
    isUploading = false
    updateUI()
}

function onRun() {
    bundleTitleScreen.style.display = 'none'
    run()
}

export function initLoadScreen() {
    function upload(this: HTMLInputElement) {
        if (this.files?.length ?? 0 > 0) {
            onUpload(this.files!)
        }
    }

    dirInput.addEventListener('change', upload, false)
    archiveInput.addEventListener('change', upload, false)

    clearButton.onclick = () => onClearStorageClick()

    runButton.onclick = () => onRun()

    updateUI()
}
