import { isMounted, clearAssets, fs, ccloaderVersion } from './fs-proxy'
import { run } from './main'
import { uploadCrossCode } from './upload-processing'

declare global {
    const storageInfoLabel: HTMLSpanElement
    const uploadStatusLabel: HTMLSpanElement
    const gameInfoLabel: HTMLSpanElement

    const dirInput: HTMLInputElement

    const clearButton: HTMLButtonElement
    const runButton: HTMLButtonElement
}

function updateElementsEnabled() {
    const isEnabled = isMounted

    dirInput.disabled = !isEnabled
    runButton.disabled = !isEnabled
}

import type { ChangelogFileData } from 'ultimate-crosscode-typedefs/file-types/changelog'

async function loadVersion(): Promise<string> {
    const changelogText = await fs.promises.readFile('/assets/data/changelog.json', 'utf8')
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
        gameVersionStr = await loadVersion()
        ccloaderVersionStr = ccloaderVersion!
    } else {
        gameInfoLabel.style.visibility = 'hidden'
    }

    gameInfoLabel.textContent = `CrossCode ${gameVersionStr}\nCCLoader ${ccloaderVersionStr}`
}

export async function mountChangeEvent() {
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

export async function updateUploadStatusLabel(
    operation: string,
    fileCount: number,
    allFilesCount: number,
    dontShowTotal: boolean = false
) {
    uploadStatusLabel.style.visibility = 'inherit'

    const prefix = `${operation}: ${fileCount}`
    if (dontShowTotal) {
        uploadStatusLabel.textContent = prefix
    } else {
        const percentage = allFilesCount == 0 ? 100 : Math.floor((fileCount / allFilesCount) * 100)
        uploadStatusLabel.textContent = `${prefix} / ${allFilesCount} (${percentage}%)`
    }
}

export function showLoadScreen() {
    document.body.innerHTML += `
        <div id="bundleTitleScreen">
            <span id="storageInfoLabel"></span>
            <br>
            <button id="clearButton">Clear stoarge</button>
            <br>
            <br>
            <input id="dirInput" type="file" multiple directory webkitdirectory />
            <br>
            <span id="uploadStatusLabel" style="visibility: hidden;"></span>
            <br>
            <button id="runButton">Run</button>
            <br>
            <span id="gameInfoLabel" style="white-space: pre-line;"></span>
        </div>
    `
    const style = document.createElement('style')
    style.textContent = `
            #bundleTitleScreen {
                position: absolute;
                background-color: gray;
                border: solid;

                width: 400px;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);

                font-family: sans-serif;
                padding: 20px;
                justify-content: center;
                align-items: center;
                text-align: center;
            }

            button {
                margin: 10px;
                padding: 8px 16px;
                font-size: 16px;
                cursor: pointer;
            }
    `
    document.head.appendChild(style)

    dirInput.addEventListener(
        'change',
        function () {
            uploadCrossCode(this.files!)
        },
        false
    )

    clearButton.onclick = () => clearAssets()

    runButton.onclick = () => run()

    mountChangeEvent()
}
