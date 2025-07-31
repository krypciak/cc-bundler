import type { Manifest } from 'ultimate-crosscode-typedefs/file-types/mod-manifest'
import { FileEntry, fileEntryFromJson, fileEntryFromText } from './utils'

function functionToBlockString(func: () => void) {
    let text = func.toString()
    return text.slice(text.indexOf('{') + 1, -1)
}

export async function getRuntimeModFiles(): Promise<FileEntry[]> {
    const id = 'cc-bundler-runtime'

    return [
        fileEntryFromJson(`assets/mods/${id}/ccmod.json`, {
            id,
            title: 'cc-bundler-runtime',
            description: '',
            repository: 'https://github.com/krypciak/cc-bundler',
            tags: ['base'],
            authors: ['krypek'],
            dependencies: {
                ccloader: '>=3.4.2-alpha',
            },
            prestart: 'prestart.js',
        } as Manifest),
        fileEntryFromText(`assets/mods/${id}/prestart.js`, functionToBlockString(prestart)),
    ]
}

function prestart() {
    ig.StorageData.inject({
        // @ts-expect-error
        _loadStorageFromData(data) {
            if (data instanceof ArrayBuffer) data = new TextDecoder().decode(data)
            // @ts-expect-error
            return this.parent(data)
        },
    })

    function audioWarningFix() {
        let interacted = false

        function onInteraction() {
            if (!interacted) {
                interacted = true
                // @ts-expect-error
                ig.music?.resume()
            }
        }
        const dom = document.getElementById('game')!
        dom.addEventListener('mousedown', () => {
            onInteraction()
        })
        dom.addEventListener('touchstart', () => {
            onInteraction()
        })

        ig.SoundManager.inject({
            update() {
                if (this.context?.context?.state == 'suspended' && !interacted) return
                this.parent()
            },
        })

        const WebAudioBufferGain = ig.WebAudioBufferGain.prototype as ig.WebAudioBufferGain
        const origPlay = WebAudioBufferGain.play
        WebAudioBufferGain.play = function (when, offset) {
            if (!interacted) return
            return origPlay.call(this, when, offset)
        }
    }

    audioWarningFix()
}
