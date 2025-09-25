import 'js-fileexplorer'

declare global {
    interface Window {
        FileExplorer: new (div: HTMLDivElement, options: FileExplorerOptions) => FileExplorer
    }
}

export interface PrepareXHROptions {
    onsuccess?: XMLHttpRequest['onload']
    onload?: XMLHttpRequest['onload']
    onerror?: XMLHttpRequest['onerror']
    onabort?: XMLHttpRequest['onabort']
    onloadstart?: XMLHttpRequest['onloadstart']
    onprocess?: XMLHttpRequest['onprogress']
    ontimeout?: XMLHttpRequest['ontimeout']
    onloadend?: XMLHttpRequest['onloadend']

    method?: string
    body?: FormData
    params: FormData | { name: any; value: any }[] | Record<string, string | number>
    url: string
    headers?: Record<string, string>

    /* maybe? */
    progress?: {
        started: number
        uploadedbytes: number
        byterate: number
        percent: number
    }
    sizebytes?: number
    currchunkstart?: number
    retries?: number
    retriesleft?: number
    fileparam?: 'file' | 'folder'
    chunksize?: number
}

export interface PrepareXHR {
    xhr: XMLHttpRequest
    upload: {}

    addEventListener: XMLHttpRequest['addEventListener']
    removeEventListener: XMLHttpRequest['removeEventListener']
    GetMethod(): string
    PrepareBody(): FormData
    Send(xhrbody?: Document | XMLHttpRequestBodyInit | null): void
}

type Id = string

interface FileInfo {
    file: File
    folder: Folder
    fullPath: string
    status: 'init' | 'upload_start' | 'upload_in_progress' | 'upload_complete'
    type: 'file' | 'folder'
}

export interface FileExplorerOptions {
    group?: null

    alwaysfocused?: boolean
    capturebrowser?: boolean

    messagetimeout?: number

    displayunits?: 'iec_windows' | 'iec_formal' | 'si'
    adjustprecision?: boolean

    initpath: Path[]

    onfocus?: null
    onblur?: null

    onrefresh?(this: FileExplorer, folder: Folder, required: number): void
    onselchanged?: null

    onrename?: (
        this: FileExplorer,
        renamedCb: (entry: Entry | boolean) => void,
        folder: Folder,
        entry: Entry,
        newname: string
    ) => void
    onopenfile?(this: FileExplorer, folder: Folder, entry: Entry): void
    onnewfolder?(this: FileExplorer, created: (success: Entry | false) => void, folder: Folder): void
    onnewfile?(this: FileExplorer, created: (success: Entry | false) => void, folder: Folder): void
    oninitupload?(
        this: FileExplorer,
        startupload: (processOrError?: boolean | string) => void,
        fileInfo: FileInfo & PrepareXHROptions,
        queuestarted: number
    ): void
    onfinishedupload?(this: FileExplorer, finalize: (success: boolean, entry?: Entry) => void, fileInfo: FileInfo): void
    onuploaderror?(this: FileExplorer, fileInfo: FileInfo, error?: unknown): void
    oninitdownload?(
        this: FileExplorer,
        startdownload: (xhroptions?: PrepareXHROptions) => void,
        folder: Folder,
        ids: Id[],
        entries: Entry[]
    ): void
    ondownloadstarted?(this: FileExplorer, options: PrepareXHROptions): void
    ondownloaderror?(this: FileExplorer, options: PrepareXHROptions): void
    ondownloadurl?(
        this: FileExplorer,
        result: { name: string; url: string },
        folder: Folder,
        ids: Id[],
        entry: Entry
    ): void
    oncopy?(
        this: FileExplorer,
        copied: (success: boolean) => void,
        srcPath: Path[],
        srcIds: Id[],
        destFolder: Folder
    ): void
    onmove?(
        this: FileExplorer,
        moved: (success: boolean) => void,
        srcPath: Path,
        srcIds: Id[],
        destFolder: Folder
    ): void
    ondelete?(
        this: FileExplorer,
        deleted: (success: boolean) => void,
        folder: Folder,
        ids: Id[],
        entries: Entry[],
        recycle?: boolean
    ): void

    concurrentuploads?: number

    tools?: PartialRecord<
        'new_folder' | 'new_file' | 'upload' | 'download' | 'copy' | 'paste' | 'cut' | 'delete' | 'item_checkboxes',
        boolean
    >

    langmap?: {}
}

export interface FileExplorer {
    PrepareXHR: new (options: PrepareXHROptions) => PrepareXHR

    settings: FileExplorerOptions

    Translate(str: string): string
    SetNamedStatusBarText(name: string, text: string, timeout?: number): void
    GetCurrentFolder(): Folder | undefined
    EscapeHTML(htmlStr: string): string
    FormatStr(str: string, ...rest: string[]): string
    RefreshFolders(force?: boolean): void
}

export type Path = [string, string, { canmodify?: boolean }]

export interface Folder {
    addEventListener(eventname: string, callback: Function): void
    removeEventListener(eventname: string, callback: Function): void
    hasEventListener(eventname: string): boolean

    lastrefresh: number
    waiting: boolean
    refs: number

    SetBusyRef(newval: any): void
    IsBusy(): boolean
    AddBusyQueueCallback(callback: Function, callbackopts: any): void
    ClearBusyQueueCallbacks(): void
    GetPath(): Path[]
    GetPathIDs(): Id[]
    SetAttributes(newattrs: string): void
    SetAttribute(key: string, value: string): void
    GetAttributes(): string
    SetAutoSort(newautosort: boolean): void
    SortEntries(): void
    SetEntries(newentries: Entry[]): void
    UpdateEntries(updatedentries: Entry[]): void
    SetEntry(entry: Entry): void
    RemoveEntry(id: Id): void
    GetEntries(): Entry[]
    GetEntryIDMap(): Record<Id, Entry>
    Destroy(): void
}

export interface Entry {
    id: Id
    name: string
    hash: string
    type: 'folder' | 'file'
    overlay?: string
    thumb?: string
    tooltip?: string
    size?: number
}
