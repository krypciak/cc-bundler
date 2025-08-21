import { createServer } from 'http-server'
import { handleFunction, setAllowedDbs, updateValidUrlSet } from './http-module.ts'

export async function startHttpServer() {
    setAllowedDbs([
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/stable',
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/testing',
    ])
    await updateValidUrlSet()

    const httpServer = createServer({
        root: './dist',
        cache: -1,
        cors: true,
        showDotfiles: false,
        showDir: 'false',
        before: [handleFunction],
        https: {
            cert: './cert/localhost+2.pem',
            key: './cert/localhost+2-key.pem',
        },
    })
    const port = 33405
    console.log('http server listening to', port)
    httpServer.listen(port)
}
startHttpServer()
