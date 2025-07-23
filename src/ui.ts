import { isMounted, clearAssets, fs, ccloaderVersion } from './fs-proxy'
import { run } from './main'
import { uploadCrossCode } from './upload-processing'
import type { ChangelogFileData } from 'ultimate-crosscode-typedefs/file-types/changelog'

declare global {
    const storageInfoLabel: HTMLSpanElement
    const uploadStatusLabel: HTMLSpanElement
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
    try {
        changelogText = await fs.promises.readFile('/assets/data/changelog.json', 'utf8')
    } catch (e) {
        return
    }
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
        // gameInfoLabel.style.visibility = 'hidden'
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
            const fileCount = fs.readdirSync('/assets', { recursive: true }).length
            fileCountStr = fileCount.toString()
        } catch (e) {}

        storageInfoLabel.textContent = `Files: ${fileCountStr}`
    } else {
        storageInfoLabel.textContent = `Mounting...`
    }
}

export async function updateUploadStatusLabel(operation: string, fileCount?: number, allFilesCount?: number) {
    uploadStatusLabel.style.visibility = 'inherit'

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
    dirInput.addEventListener(
        'change',
        function () {
            uploadCrossCode(this.files!)
        },
        false
    )

    archiveInput.addEventListener(
        'change',
        function () {
            uploadCrossCode(this.files!)
        },
        false
    )

    clearButton.onclick = () => clearAssets()

    runButton.onclick = () => run()

    updateUI()
}
