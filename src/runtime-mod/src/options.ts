import type { Options } from 'ccmodmanager/types/mod-options'
import CrossCodeWebRuntimeMod from './plugin'

export let Opts: ReturnType<typeof modmanager.registerAndGetModOptions<ReturnType<typeof registerOpts>>>

export function registerOpts() {
    const opts = {
        general: {
            settings: {
                title: 'General',
                tabIcon: 'general',
            },
            headers: {
                general: {
                    hapticFeedback: {
                        type: 'CHECKBOX',
                        name: 'Enable Haptic Feedback',
                        description: 'Vibrate when the screen shakes in-game',

                        init: true,
                    },
                },
            },
        },
    } as const satisfies Options

    Opts = modmanager.registerAndGetModOptions(
        {
            modId: CrossCodeWebRuntimeMod.manifset.id,
            title: CrossCodeWebRuntimeMod.manifset.title,
        },
        opts
    )

    return opts
}
