export function checkPWA() {
    return

    // This variable will save the event for later use.
    let deferredPrompt: Event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
        console.log('beforeinstallprompt')
        // Prevents the default mini-infobar or install dialog from appearing on mobile
        e.preventDefault()
        // Save the event because you'll need to trigger it later.
        deferredPrompt = e
        // Show your customized install prompt for your PWA
        // Your own UI doesn't have to be a single element, you
        // can have buttons in different locations, or wait to prompt
        // as part of a critical journey.
    })
}
