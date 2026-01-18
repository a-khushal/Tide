import type { PlasmoContentScript } from "plasmo"
import type { AnalysisData, FrameworkInfo, LibraryInfo, PerformanceMetrics, ScriptInfo } from "./types"

export const config: PlasmoContentScript = {
    matches: ["<all_urls>"],
    all_frames: false
}

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
        
        if (size > 0) {
            scripts.push({
                src: entry.name,
                size: size,
                gzippedSize: gzippedSize,
                loadTime: entry.responseEnd - entry.startTime,
                parseTime: Math.max(0, entry.duration - (entry.responseEnd - entry.startTime))
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
                
                if (size > 0) {
                    scripts.push({
                        src: src,
                        size: size,
                        gzippedSize: gzippedSize,
                        loadTime: perfEntry.responseEnd - perfEntry.startTime,
                        parseTime: Math.max(0, perfEntry.duration - (perfEntry.responseEnd - perfEntry.startTime))
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

    return {
        scripts,
        frameworks,
        libraries: libraries.slice(0, 5),
        performance,
        totalSize,
        totalGzippedSize
    }
}

async function sendAnalysisToBackground() {
    try {
        const analysis = await analyzePage()
        chrome.runtime.sendMessage({
            type: "PAGE_ANALYSIS",
            data: analysis,
            url: window.location.href
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Failed to send analysis:", chrome.runtime.lastError)
            }
        })
    } catch (error) {
        console.error("Analysis error:", error)
    }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(sendAnalysisToBackground, 1000)
} else {
    window.addEventListener("load", () => {
        setTimeout(sendAnalysisToBackground, 1000)
    })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "REQUEST_ANALYSIS") {
        analyzePage().then(analysis => {
            chrome.runtime.sendMessage({
                type: "PAGE_ANALYSIS",
                data: analysis,
                url: window.location.href
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Failed to send analysis:", chrome.runtime.lastError)
                    sendResponse({ success: false })
                } else {
                    sendResponse({ success: true })
                }
            })
        }).catch(error => {
            console.error("Analysis error:", error)
            sendResponse({ success: false })
        })
        return true
    }
    return false
})

