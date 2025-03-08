export async function compress(str: any) {
    // Convert the string to a byte stream.
    const stream = new Blob([str]).stream()

    // Create a compressed stream.
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'))

    // Read all the bytes from this stream.
    const chunks: Uint8Array[] = []
    for await (const chunk of compressedStream) {
        chunks.push(chunk)
    }
    return await concatUint8Arrays(chunks)
}

export async function decompressToChunks(compressedBytes: Uint8Array): Promise<Uint8Array> {
    // Convert the bytes to a stream.
    const stream = new Blob([compressedBytes]).stream()

    // Create a decompressed stream.
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'))

    // Read all the bytes from this stream.
    const chunks: Uint8Array[] = []
    for await (const chunk of decompressedStream) {
        chunks.push(chunk)
    }
    return await concatUint8Arrays(chunks)
}
export async function decompressToString(compressedBytes: Uint8Array): Promise<string> {
    const arr = await decompressToChunks(compressedBytes)
    return new TextDecoder().decode(arr)
}

async function concatUint8Arrays(uint8arrays: Uint8Array[]) {
    const blob = new Blob(uint8arrays)
    const buffer = await blob.arrayBuffer()
    return new Uint8Array(buffer)
}
