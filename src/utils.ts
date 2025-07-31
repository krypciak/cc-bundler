export async function getUint8Array(file: {
    bytes?(): Promise<Uint8Array>
    arrayBuffer(): Promise<ArrayBuffer>
}): Promise<Uint8Array> {
    if (file.bytes) {
        return file.bytes()
    } else {
        return new Uint8Array(await file.arrayBuffer())
    }
}

export interface FileEntry {
    path: string
    uint8Array(): Promise<Uint8Array>
}

export function fileEntryFromFile(file: File, addPrefix = ''): FileEntry {
    return {
        path: addPrefix + file.webkitRelativePath,
        async uint8Array() {
            try {
                return getUint8Array(file)
            } catch (e) {
                console.error(e)
                return new Uint8Array()
            }
        },
    }
}

export function textToUint8Array(text: string) {
    return new TextEncoder().encode(text)
}

export function fileEntryFromText(path: string, text: string) {
    return {
        path,
        async uint8Array() {
            return textToUint8Array(text)
        },
    }
}

export function fileEntryFromJson(path: string, json: object) {
    return fileEntryFromText(path, JSON.stringify(json))
}

export function throwErrorWithCode(msg: string, code: string): never {
    const err = new Error(msg)
    // @ts-expect-error
    err.code = code
    throw err
}
