import { Opts } from './options'
import { isAndroid, reportRumbleAndroid } from '../../android-bridge'

export function initVibrationBridge() {
    ig.Rumble.RumbleHandle.inject({
        _updatePosition(power) {
            this.parent(power)

            if (Opts.hapticFeedback) {
                reportRumble(power, this.shakeDuration)
            }
        },
    })
}

function reportRumble(strength: number, effectDuration: number) {
    if (isAndroid()) {
        reportRumbleAndroid(strength, effectDuration)
    } else {
        reportRumbleWeb(strength, effectDuration)
    }
}

async function reportRumbleWeb(strength: number, effectDuration: number) {
    if (!navigator.vibrate) return

    const MAX_RUMBLE_STRENGTH = 15.0
    const MAX_VIB_DURATION_MILLIS = 40
    const NORMAL_EFFECT_DURATION = 0.2

    if (strength > MAX_RUMBLE_STRENGTH) return
    if (effectDuration > NORMAL_EFFECT_DURATION) return

    const vibrationDuration = Math.ceil(MAX_VIB_DURATION_MILLIS * (strength / MAX_RUMBLE_STRENGTH))

    if (vibrationDuration === 0) return

    navigator.vibrate(vibrationDuration)
}
