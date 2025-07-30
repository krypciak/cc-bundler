const autorunKey = 'cc-bundler-autorun'
type Autorun = 'on' | 'off' | 'one-time-off'
export function isAutorunOn() {
    return localStorage[autorunKey] == 'on'
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

export function checkAutorun() {
    if (isAutorunOn()) runButton.click()
    else if (getAutorun() == 'one-time-off') {
        setAutorun('on')
    }
}
