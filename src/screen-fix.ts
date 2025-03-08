function setup_screen() {
    let width = 0
    let height = 0
    const gameW = window['IG_WIDTH']
    const gameH = window['IG_HEIGHT']
    const w = $(window).width()!
    const h = $(window).height()!
    if (w / h > gameW / gameH) {
        height = h
        width = (gameW * h) / gameH
    } else {
        width = w
        height = (gameH * w) / gameW
    }
    for (let scale = 1; scale < 4; scale++) {
        if (Math.abs(width - gameW * scale) < 4) {
            width = gameW * scale
            height = gameH * scale
        }
    }
    $('#canvas').width(width)
    $('#canvas').height(height)
    $('#canvas')[0].className = 'borderHidden'
}

export function resizeFix() {
    setup_screen()
    $(window).on('resize', () => {
        if (window.sc?.options) {
            sc.options._setDisplaySize()
        } else {
            setup_screen()
        }
    })
}
