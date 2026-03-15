import { Fullscreen } from '@boengli/capacitor-fullscreen'

export async function tryEnterAndroidFullscreen() {
    try {
        await Fullscreen.setLegacyFallbackEnabled(true)
        await Fullscreen.activateImmersiveMode()
    } catch (error) {
        console.error('Error enabling fullscreen:', error)
    }
}
