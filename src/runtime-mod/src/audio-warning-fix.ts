export function audioWarningFix() {
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
