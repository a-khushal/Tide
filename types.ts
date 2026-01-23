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
    hasEval: boolean
    untrustedDomain: boolean
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

export interface SecurityIssue {
    type: "vulnerable_version" | "eval_usage" | "untrusted_domain" | "csp_violation"
    severity: "high" | "medium" | "low"
    message: string
    script?: string
    library?: string
    version?: string
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
    securityIssues: SecurityIssue[]
    timestamp: number
}

export interface HistoryEntry {
    timestamp: number
    totalSize: number
    scriptCount: number
    thirdPartySize: number
}

export interface DomainHistory {
    domain: string
    entries: HistoryEntry[]
    lastUpdated: number
}