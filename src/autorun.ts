const autorunKey = 'cc-bundler-autorun'
type Autorun = 'on' | 'off' | 'one-time-off'

export function isAutorunOn() {
    return getAutorun() == 'on'
}
export function getAutorun(): Autorun {
    return localStorage[autorunKey] ?? 'off'
}
export function setAutorun(state: Autorun) {
    localStorage[autorunKey] = state
}

export function exit() {
    if (isAutorunOn()) setAutorun('one-time-off')
    location.reload()
}

export function checkAutorun(): boolean {
    if (isAutorunOn()) {
        runButton.click()
        return true
    }

    if (getAutorun() == 'one-time-off') {
        setAutorun('on')
    }
    return false
}
