import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Opts } from './options'

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
    if (reportRumbleAndroid(strength, effectDuration)) return
    reportRumbleCapacitor(strength, effectDuration)
}

function reportRumbleAndroid(strength: number, effectDuration: number): boolean {
    if (window.CrosscodeWebAndroidNative) {
        window.CrosscodeWebAndroidNative.reportRumble(strength, effectDuration)
        return true
    }
    return false
}

const MAX_RUMBLE_STRENGTH = 15.0
const MAX_VIB_DURATION_MILLIS = 40
const NORMAL_EFFECT_DURATION = 0.2

async function reportRumbleCapacitor(strength: number, effectDuration: number) {
    if (strength > MAX_RUMBLE_STRENGTH) return
    if (effectDuration > NORMAL_EFFECT_DURATION) return

    const normalizedStrength = strength / MAX_RUMBLE_STRENGTH

    const vibrationDuration = Math.ceil(MAX_VIB_DURATION_MILLIS * normalizedStrength)

    if (vibrationDuration == 0) return

    const style: ImpactStyle =
        normalizedStrength < 0.33
            ? ImpactStyle.Light
            : normalizedStrength < 0.66
              ? ImpactStyle.Medium
              : ImpactStyle.Heavy

    await Haptics.impact({ style })

    if (normalizedStrength > 0.7) {
        await Haptics.vibrate()
    }
}
