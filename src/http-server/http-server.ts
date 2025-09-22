import { createServer } from 'http-server'
import { handleFunction as modProxyHandle, setAllowedDbs, updateValidUrlSet } from './http-module-mod-proxy.ts'
import {
    handleFunction as liveModUpdatesHandle,
    setModConfigs,
    startWatchingMods,
} from './http-module-live-mod-updates.ts'

export async function startHttpServer() {
    setAllowedDbs([
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/stable',
        'https://raw.githubusercontent.com/CCDirectLink/CCModDB/testing',
    ])
    await updateValidUrlSet()

    setModConfigs([
        // {
        //     id: 'cc-multibakery',
        //     repoPath: '/home/krypek/home/Programming/crosscode/instances/cc-server/assets/mods/cc-multibakery',
        //     buildCmd: 'bun',
        //     buildArguments: [
        //         'build.ts',
        //         'build',
        //         // 'minifySyntax=true',
        //         // 'minifyWhitespace=true',
        //         'physics=false',
        //         'browser=true',
        //         'target=es2024',
        //         'extraTreeShaking=true',
        //         'noWrite=true',
        //     ],
        // },
        // {
        //     id: 'cc-instanceinator',
        //     repoPath: '/home/krypek/home/Programming/crosscode/instances/cc-server/assets/mods/cc-instanceinator',
        //     buildCmd: 'esbuild',
        //     buildArguments: [
        //         '--target=es2018',
        //         '--format=esm',
        //         '--platform=node',
        //         '--bundle',
        //         '--sourcemap=inline',
        //         'src/plugin.ts',
        //     ],
        // },
    ])
    startWatchingMods()

    const httpServer = createServer({
        root: './dist',
        cache: -1,
        cors: true,
        showDotfiles: false,
        showDir: 'false',
        before: [modProxyHandle, liveModUpdatesHandle],
        https: {
            cert: './cert/localhost+1.pem',
            key: './cert/localhost+1-key.pem',
        },
    })
    const port = 33405
    console.log('http server listening to', port)
    httpServer.listen(port)
}
startHttpServer()
