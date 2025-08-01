import type { Dirent, Stats } from 'fs'

class DirentBase {
    isFile(): boolean {
        return this.file
    }
    isDirectory(): boolean {
        return !this.file
    }
    isBlockDevice(): boolean {
        return false
    }
    isCharacterDevice(): boolean {
        return false
    }
    isSymbolicLink(): boolean {
        return false
    }
    isFIFO(): boolean {
        return false
    }
    isSocket(): boolean {
        return false
    }

    public constructor(private file: boolean) {}
}

export class OpfsDirent extends DirentBase implements Dirent {
    constructor(
        file: boolean,
        public name: string,
        public parentPath: string,
        public path: string
    ) {
        super(file)
    }
}

export class OpfsStats extends DirentBase implements Stats {
    dev = 0
    ino = 0
    mode = 0
    nlink = 0
    uid = 1000
    gid = 1000
    rdev = 0
    size = 0
    blksize = 4096
    blocks = 0
    atimeMs = 0
    mtimeMs = 0
    ctimeMs = 0
    birthtimeMs = 0
    atime = 0 as any
    mtime = 0 as any
    ctime = 0 as any
    birthtime = 0 as any
}

export const constants = {
    UV_FS_SYMLINK_DIR: 1,
    UV_FS_SYMLINK_JUNCTION: 2,
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    UV_DIRENT_UNKNOWN: 0,
    UV_DIRENT_FILE: 1,
    UV_DIRENT_DIR: 2,
    UV_DIRENT_LINK: 3,
    UV_DIRENT_FIFO: 4,
    UV_DIRENT_SOCKET: 5,
    UV_DIRENT_CHAR: 6,
    UV_DIRENT_BLOCK: 7,
    S_IFMT: 61440,
    S_IFREG: 32768,
    S_IFDIR: 16384,
    S_IFCHR: 8192,
    S_IFBLK: 24576,
    S_IFIFO: 4096,
    S_IFLNK: 40960,
    S_IFSOCK: 49152,
    O_CREAT: 64,
    O_EXCL: 128,
    UV_FS_O_FILEMAP: 0,
    O_NOCTTY: 256,
    O_TRUNC: 512,
    O_APPEND: 1024,
    O_DIRECTORY: 65536,
    O_NOATIME: 262144,
    O_NOFOLLOW: 131072,
    O_SYNC: 1052672,
    O_DSYNC: 4096,
    O_DIRECT: 16384,
    O_NONBLOCK: 2048,
    S_IRWXU: 448,
    S_IRUSR: 256,
    S_IWUSR: 128,
    S_IXUSR: 64,
    S_IRWXG: 56,
    S_IRGRP: 32,
    S_IWGRP: 16,
    S_IXGRP: 8,
    S_IRWXO: 7,
    S_IROTH: 4,
    S_IWOTH: 2,
    S_IXOTH: 1,
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    UV_FS_COPYFILE_EXCL: 1,
    COPYFILE_EXCL: 1,
    UV_FS_COPYFILE_FICLONE: 2,
    COPYFILE_FICLONE: 2,
    UV_FS_COPYFILE_FICLONE_FORCE: 4,
    COPYFILE_FICLONE_FORCE: 4,
}
