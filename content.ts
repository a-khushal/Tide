import type { PlasmoContentScript } from "plasmo"
import type { AnalysisData, FrameworkInfo, LibraryInfo, PerformanceMetrics, ScriptInfo } from "./types"

export const config: PlasmoContentScript = {
    matches: ["<all_urls>"],
    all_frames: false
}

let extensionActive = true

try {
    const port = chrome.runtime.connect({ name: "content-script-connection" })
    
    port.onDisconnect.addListener(() => {
        extensionActive = false
        console.warn("Extension context invalidated - disabling extension API calls")
    })
    
    port.onMessage.addListener(() => {
    })
} catch (error) {
    extensionActive = false
    console.warn("Failed to establish extension connection:", error)
}

function isExtensionContextValid(): boolean {
    if (!extensionActive) {
        return false
    }
    try {
        if (typeof chrome === "undefined" || typeof chrome.runtime === "undefined") {
            extensionActive = false
            return false
        }
        const id = chrome.runtime.id
        if (id === undefined || id === null) {
            extensionActive = false
            return false
        }
        return true
    } catch (error) {
        extensionActive = false
        if (error instanceof Error && error.message.includes("Extension context invalidated")) {
            return false
        }
        return false
    }
}

window.addEventListener("error", (event) => {
    if (event.error?.message?.includes("Extension context invalidated")) {
        event.preventDefault()
        extensionActive = false
        console.warn("Caught Extension context invalidated error:", event.error)
        return true
    }
    return false
})

window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.message?.includes("Extension context invalidated")) {
        event.preventDefault()
        extensionActive = false
        console.warn("Caught unhandled Extension context invalidated rejection:", event.reason)
        return true
    }
    return false
})

function detectFrameworks(): FrameworkInfo[] {
    const frameworks: FrameworkInfo[] = []
    const win = window as any

    if (win.React || win.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const version = win.React?.version || null
        frameworks.push({ name: "React", version, detected: true })
    }

    if (win.Vue || win.__VUE__) {
        const version = win.Vue?.version || win.__VUE__?.version || null
        frameworks.push({ name: "Vue", version, detected: true })
    }

    if (win.ng || win.angular) {
        const version = win.angular?.version?.full || null
        frameworks.push({ name: "Angular", version, detected: true })
    }

    if (win.__SVELTE__ || win.svelte) {
        const version = win.__SVELTE__?.version || null
        frameworks.push({ name: "Svelte", version, detected: true })
    }

    if (win.__NEXT_DATA__ || document.querySelector('script[id="__NEXT_DATA__"]')) {
        const nextData = win.__NEXT_DATA__
        const version = nextData?.buildId ? "detected" : null
        frameworks.push({ name: "Next.js", version, detected: true })
    }

    if (win.__NUXT__ || document.querySelector('script[data-n-head="ssr"]')) {
        const nuxt = win.__NUXT__
        const version = nuxt?.version || null
        frameworks.push({ name: "Nuxt", version, detected: true })
    }

    return frameworks
}

function detectLibraries(): LibraryInfo[] {
    const libraries: LibraryInfo[] = []
    const win = window as any

    const libraryDetectors: Array<[string, () => boolean, () => string | null]> = [
        ["jQuery", () => !!win.jQuery || !!win.$, () => win.jQuery?.fn?.jquery || win.$?.fn?.jquery || null],
        ["Lodash", () => !!win._ || !!win.lodash, () => win._?.VERSION || win.lodash?.VERSION || null],
        ["D3", () => !!win.d3, () => win.d3?.version || null],
        ["Three.js", () => !!win.THREE, () => win.THREE?.REVISION || null],
        ["Moment.js", () => !!win.moment, () => win.moment?.version || null],
        ["Axios", () => !!win.axios, () => win.axios?.VERSION || null],
        ["Underscore", () => !!win._ && !win.lodash, () => win._?.VERSION || null],
        ["Backbone", () => !!win.Backbone, () => win.Backbone?.VERSION || null],
        ["Ember", () => !!win.Ember, () => win.Ember?.VERSION || null],
        ["Knockout", () => !!win.ko, () => win.ko?.version || null]
    ]

    for (const [name, detector, versionGetter] of libraryDetectors) {
        if (detector()) {
            libraries.push({
                name,
                version: versionGetter(),
                detected: true
            })
        }
    }

    return libraries.sort((a, b) => a.name.localeCompare(b.name))
}

function inferGlobalKey(src: string): string | null {
    try {
        const url = new URL(src, window.location.href)
        const file = url.pathname.split("/").pop() || ""
        const base = file.split(".")[0] || ""
        const cleaned = base.replace(/[^a-zA-Z0-9_$]/g, "")
        return cleaned.length >= 3 ? cleaned : null
    } catch {
        return null
    }
}

function isLikelyUnused(script: { firstParty: boolean; isCDN: boolean; src: string }): boolean {
    if (script.firstParty) return false
    const key = inferGlobalKey(script.src)
    if (!key) return false
    const win = window as any
    try {
        if (key in win) return false
    } catch {
        return false
    }
    return true
}

function collectPerformanceMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
        longTasks: 0,
        scriptLoadTime: 0,
        scriptParseTime: 0,
        timeToInteractive: 0,
        mainThreadBlockingTime: 0
    }

    if (typeof PerformanceObserver === "undefined") {
        return metrics
    }

    const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
                metrics.longTasks++
                metrics.mainThreadBlockingTime += entry.duration - 50
            }
        }
    })

    try {
        longTaskObserver.observe({ entryTypes: ["longtask"] })
    } catch (e) {
    }

    const perfEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    const scriptEntries = perfEntries.filter(entry =>
        entry.initiatorType === "script" ||
        entry.name.endsWith(".js") ||
        entry.name.includes("javascript")
    )

    let totalLoadTime = 0
    let totalParseTime = 0

    for (const entry of scriptEntries) {
        const loadTime = entry.responseEnd - entry.startTime
        const parseTime = entry.duration - loadTime
        totalLoadTime += loadTime
        totalParseTime += Math.max(0, parseTime)
    }

    metrics.scriptLoadTime = totalLoadTime
    metrics.scriptParseTime = totalParseTime

    const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
    if (navigationEntry) {
        const domContentLoaded = navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart
        const loadEvent = navigationEntry.loadEventEnd - navigationEntry.loadEventStart
        metrics.timeToInteractive = navigationEntry.domInteractive
            ? navigationEntry.domInteractive - navigationEntry.fetchStart
            : 0
    }

    return metrics
}

function collectScriptInfo(): ScriptInfo[] {
    const scripts: ScriptInfo[] = []
    const perfEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    const scriptTags = Array.from(document.querySelectorAll("script[src]"))

    const scriptAttrMap = new Map<string, { async: boolean; defer: boolean; module: boolean }>()
    for (const tag of scriptTags) {
        const element = tag as HTMLScriptElement
        if (element.src) {
            scriptAttrMap.set(element.src, {
                async: !!element.async,
                defer: !!element.defer,
                module: element.type === "module"
            })
        }
    }

    const cdnHosts = [
        "cdn.",
        "cloudflare.com",
        "unpkg.com",
        "jsdelivr.net",
        "googleapis.com",
        "gstatic.com",
        "akamaihd.net",
        "fastly.net",
        "bootstrapcdn.com",
        "cdnjs.com"
    ]

    const scriptMap = new Map<string, PerformanceResourceTiming>()
    
    for (const entry of perfEntries) {
        const isScript = entry.initiatorType === "script" || 
                             entry.name.endsWith(".js") || 
                             entry.name.includes(".js?") ||
                             entry.name.includes(".mjs") ||
                             entry.name.includes("javascript")
        
        if (isScript) {
            const existing = scriptMap.get(entry.name)
            if (!existing || entry.transferSize > existing.transferSize || entry.decodedBodySize > existing.decodedBodySize) {
                scriptMap.set(entry.name, entry)
            }
        }
    }

    for (const entry of scriptMap.values()) {
        const transferSize = entry.transferSize || 0
        const decodedSize = entry.decodedBodySize || 0
        const encodedSize = (entry as any).encodedBodySize || 0
        
        const uncompressedSize = decodedSize > 0 ? decodedSize : (encodedSize > 0 ? encodedSize : transferSize)
        const compressedSize = transferSize > 0 ? transferSize : (encodedSize > 0 ? encodedSize : decodedSize)
        
        const size = uncompressedSize > 0 ? uncompressedSize : compressedSize
        const gzippedSize = compressedSize > 0 ? compressedSize : size

        let host = ""
        let firstParty = false
        let isCDN = false
        try {
            const url = new URL(entry.name)
            host = url.hostname
            firstParty = url.hostname === window.location.hostname
            isCDN = cdnHosts.some(h => url.hostname.includes(h))
        } catch {
        }

        const attrs = scriptAttrMap.get(entry.name) || { async: false, defer: false, module: false }
        
        if (size > 0) {
            const potentiallyUnused = isLikelyUnused({ firstParty, isCDN, src: entry.name })
            scripts.push({
                src: entry.name,
                size: size,
                gzippedSize: gzippedSize,
                loadTime: entry.responseEnd - entry.startTime,
                parseTime: Math.max(0, entry.duration - (entry.responseEnd - entry.startTime)),
                firstParty,
                host,
                isCDN,
                async: attrs.async,
                defer: attrs.defer,
                module: attrs.module,
                potentiallyUnused
            })
        }
    }

    for (const scriptTag of scriptTags) {
        const src = (scriptTag as HTMLScriptElement).src
        if (src && !scriptMap.has(src)) {
            const perfEntry = perfEntries.find(e => e.name === src || e.name === new URL(src, window.location.href).href)
            if (perfEntry) {
                const transferSize = perfEntry.transferSize || 0
                const decodedSize = perfEntry.decodedBodySize || 0
                const encodedSize = (perfEntry as any).encodedBodySize || 0
                
                const uncompressedSize = decodedSize > 0 ? decodedSize : (encodedSize > 0 ? encodedSize : transferSize)
                const compressedSize = transferSize > 0 ? transferSize : (encodedSize > 0 ? encodedSize : decodedSize)
                
                const size = uncompressedSize > 0 ? uncompressedSize : compressedSize
                const gzippedSize = compressedSize > 0 ? compressedSize : size

                let host = ""
                let firstParty = false
                let isCDN = false
                try {
                    const url = new URL(src, window.location.href)
                    host = url.hostname
                    firstParty = url.hostname === window.location.hostname
                    isCDN = cdnHosts.some(h => url.hostname.includes(h))
                } catch {
                }

                const attrs = scriptAttrMap.get(src) || { async: false, defer: false, module: false }
                
                if (size > 0) {
                    const potentiallyUnused = isLikelyUnused({ firstParty, isCDN, src })
                    scripts.push({
                        src: src,
                        size: size,
                        gzippedSize: gzippedSize,
                        loadTime: perfEntry.responseEnd - perfEntry.startTime,
                        parseTime: Math.max(0, perfEntry.duration - (perfEntry.responseEnd - perfEntry.startTime)),
                        firstParty,
                        host,
                        isCDN,
                        async: attrs.async,
                        defer: attrs.defer,
                        module: attrs.module,
                        potentiallyUnused
                    })
                }
            }
        }
    }

    return scripts
}

async function analyzePage(): Promise<AnalysisData> {
    const scripts = collectScriptInfo()
    const frameworks = detectFrameworks()
    const libraries = detectLibraries()
    const performance = collectPerformanceMetrics()

    const totalSize = scripts.reduce((sum, s) => sum + s.size, 0)
    const totalGzippedSize = scripts.reduce((sum, s) => sum + s.gzippedSize, 0)
    const firstPartySize = scripts.filter(s => s.firstParty).reduce((sum, s) => sum + s.size, 0)
    const thirdPartySize = scripts.filter(s => !s.firstParty).reduce((sum, s) => sum + s.size, 0)
    const firstPartyCount = scripts.filter(s => s.firstParty).length
    const thirdPartyCount = scripts.filter(s => !s.firstParty).length
    const cdnScripts = scripts.filter(s => s.isCDN)
    const cdnCount = cdnScripts.length
    const cdnSize = cdnScripts.reduce((sum, s) => sum + s.size, 0)
    const unusedScripts = scripts.filter(s => s.potentiallyUnused)

    return {
        scripts,
        frameworks,
        libraries: libraries.slice(0, 5),
        performance,
        totalSize,
        totalGzippedSize,
        firstPartySize,
        thirdPartySize,
        firstPartyCount,
        thirdPartyCount,
        cdnCount,
        cdnSize
    }
}


async function sendAnalysisToBackground() {
    if (!extensionActive) {
        return
    }
    
    try {
        const analysis = await analyzePage()
        
        if (!extensionActive) {
            return
        }
        
        try {
            chrome.runtime.sendMessage({
                type: "PAGE_ANALYSIS",
                data: analysis,
                url: window.location.href
            }, () => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message?.includes("Extension context invalidated")) {
                        extensionActive = false
                    }
                }
            })
        } catch (sendError) {
            if (sendError instanceof Error && sendError.message.includes("Extension context invalidated")) {
                extensionActive = false
            }
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes("Extension context invalidated")) {
            extensionActive = false
        }
    }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(sendAnalysisToBackground, 1000)
} else {
    window.addEventListener("load", () => {
        setTimeout(sendAnalysisToBackground, 1000)
    })
}

if (extensionActive) {
    try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!extensionActive) {
                sendResponse({ success: false, error: "Extension context invalidated" })
                return false
            }

            console.log("Content script received message:", message.type)
            if (message.type === "REQUEST_ANALYSIS") {
                console.log("Starting page analysis...")
                analyzePage().then(analysis => {
                    if (!extensionActive) {
                        sendResponse({ success: false, error: "Extension context invalidated" })
                        return
                    }

                    console.log("Analysis complete, sending to background:", analysis)
                    try {
                        chrome.runtime.sendMessage({
                            type: "PAGE_ANALYSIS",
                            data: analysis,
                            url: window.location.href
                        }, () => {
                            if (chrome.runtime.lastError) {
                                if (chrome.runtime.lastError.message?.includes("Extension context invalidated")) {
                                    extensionActive = false
                                    sendResponse({ success: false, error: "Extension context invalidated" })
                                } else {
                                    console.error("Failed to send analysis:", chrome.runtime.lastError)
                                    sendResponse({ success: false })
                                }
                            } else {
                                console.log("Analysis sent successfully")
                                sendResponse({ success: true })
                            }
                        })
                    } catch (error) {
                        if (error instanceof Error && error.message.includes("Extension context invalidated")) {
                            extensionActive = false
                            sendResponse({ success: false, error: "Extension context invalidated" })
                        } else {
                            console.error("Error sending message:", error)
                            sendResponse({ success: false })
                        }
                    }
                }).catch(error => {
                    if (error instanceof Error && error.message.includes("Extension context invalidated")) {
                        extensionActive = false
                        sendResponse({ success: false, error: "Extension context invalidated" })
                    } else {
                        console.error("Analysis error:", error)
                        sendResponse({ success: false })
                    }
                })
                return true
            }
            return false
        })
    } catch (error) {
        if (error instanceof Error && error.message.includes("Extension context invalidated")) {
            extensionActive = false
        } else {
            console.error("Error registering message listener:", error)
        }
    }
}

