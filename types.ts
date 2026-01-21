export interface ScriptInfo {
    src: string
    size: number
    gzippedSize: number
    loadTime: number
    parseTime: number
    firstParty: boolean
    host: string
    isCDN: boolean
    async: boolean
    defer: boolean
    module: boolean
    potentiallyUnused: boolean
}

export interface FrameworkInfo {
    name: string
    version: string | null
    detected: boolean
}

export interface LibraryInfo {
    name: string
    version: string | null
    detected: boolean
}

export interface PerformanceMetrics {
    longTasks: number
    scriptLoadTime: number
    scriptParseTime: number
    timeToInteractive: number
    mainThreadBlockingTime: number
}

export interface AnalysisData {
    scripts: ScriptInfo[]
    frameworks: FrameworkInfo[]
    libraries: LibraryInfo[]
    performance: PerformanceMetrics
    totalSize: number
    totalGzippedSize: number
    firstPartySize: number
    thirdPartySize: number
    firstPartyCount: number
    thirdPartyCount: number
    cdnCount: number
    cdnSize: number
}