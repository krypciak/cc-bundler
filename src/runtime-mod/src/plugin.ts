import type { PluginClass } from 'ultimate-crosscode-typedefs/modloader/mod'
import type { Mod1 } from './types'
import ccmod from '../ccmod.json'
import { Autorun, getAutorun, setAutorun } from '../../autorun'
import { registerOpts } from './options'
import { initVibrationBridge } from './vibration'

export default class CrossCodeWebRuntimeMod implements PluginClass {
    static dir: string
    static mod: Mod1
    static manifset: typeof import('../ccmod.json') = ccmod

    constructor(mod: Mod1) {
        CrossCodeWebRuntimeMod.dir = mod.baseDirectory
        CrossCodeWebRuntimeMod.mod = mod
        CrossCodeWebRuntimeMod.mod.isCCL3 = mod.findAllAssets ? true : false
        CrossCodeWebRuntimeMod.mod.isCCModPacked = mod.baseDirectory.endsWith('.ccmod/')
    }

    prestart() {
        registerOpts()
        this.ccSaveFix()
        this.audioWarningFix()
        initVibrationBridge()
    }

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
