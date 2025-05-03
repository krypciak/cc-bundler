export function audioWarningFix() {
    let interacted = false

    document.getElementById('game')!.addEventListener('mousedown', () => {
        if (!interacted) {
            interacted = true
            // @ts-expect-error
            ig.music?.resume()
        }
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
