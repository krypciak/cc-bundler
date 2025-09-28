export function shouldIgnoreRequestPath(path: string) {
    return (
        path == '/details' ||
        path == '/icon' ||
        path.startsWith('/socket.io/') ||
        path.startsWith('/cdn-cgi/') ||
        path.startsWith('/liveModUpdate')
    )
}
