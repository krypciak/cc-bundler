import { isMounted, clearStorage, fs, ccloaderVersion } from './fs-proxy'
import { run } from './main'
import { uploadCrossCode } from './upload-processing'
import type { ChangelogFileData } from 'ultimate-crosscode-typedefs/file-types/changelog'

declare global {
    const storageInfoLabel: HTMLDivElement
    const uploadStatusLabel: HTMLDivElement
    const gameInfoLabel: HTMLDivElement

    const dirInput: HTMLInputElement
    const archiveInput: HTMLInputElement

    const clearButton: HTMLButtonElement
    const runButton: HTMLButtonElement
}

function updateElementsEnabled() {
    const isEnabled = isMounted

    dirInput.disabled = !isEnabled
    archiveInput.disabled = !isEnabled
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

async function updateGameInfo() {
    let gameVersionStr = 'loading...'
    let ccloaderVersionStr = 'loading...'

    if (isMounted) {
        gameInfoLabel.style.visibility = 'inherit'

        const gameVersion = await loadVersion()
        runButton.disabled = !gameVersion
        gameVersionStr = gameVersion ?? 'not installed'

        ccloaderVersionStr = ccloaderVersion!
    } else {
        gameInfoLabel.style.visibility = 'hidden'
    }

    gameInfoLabel.innerHTML = `CrossCode: ${gameVersionStr} <br /> CCLoader: ${ccloaderVersionStr}`
}

export async function updateUI() {
    updateStorageInfoLabel()
    updateElementsEnabled()
    updateGameInfo()
}

export async function updateStorageInfoLabel() {
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
    } else {
        storageInfoLabel.innerHTML = `Mounting... <br> <wbr>`
    }
}

export async function updateUploadStatusLabel(operation: string, fileCount?: number, allFilesCount?: number) {
    const getText = () => {
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

export function showLoadScreen() {
    function upload(this: HTMLInputElement) {
        if (this.files?.length ?? 0 > 0) {
            uploadCrossCode(this.files!)
        }
    }

    dirInput.addEventListener('change', upload, false)
    archiveInput.addEventListener('change', upload, false)

    clearButton.onclick = () => clearStorage()

    runButton.onclick = () => run()

    updateUI()
}
