import { Autorun, getAutorun, setAutorun } from '../autorun'

export default class BundlerRuntimeMod {
    audioWarningFix() {
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

    ccSaveFix() {
        ig.StorageData.inject({
            // @ts-expect-error
            _loadStorageFromData(data) {
                if (data instanceof ArrayBuffer) data = new TextDecoder().decode(data)
                // @ts-expect-error
                return this.parent(data)
            },
        })
    }

    prestart() {
        this.ccSaveFix()
        this.audioWarningFix()
    }

    autorunBackup: Autorun = 'off'
    preload() {
        this.autorunBackup = getAutorun()
        setAutorun('off')
    }
    poststart() {
        setTimeout(() => {
            setAutorun(this.autorunBackup)
        }, 300)
    }
}
