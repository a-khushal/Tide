import type { AnalysisData, DomainHistory, HistoryEntry } from "./types"
const analysisCache = new Map<string, AnalysisData>()
const scriptMonitor: Array<{ src: string; action: string; timestamp: number }> = []
let currentAnalysis: AnalysisData | null = null

function getDomainFromUrl(url: string): string {
    try {
        return new URL(url).hostname
    } catch {
        return url
    }
}

async function saveHistory(domain: string, data: AnalysisData): Promise<void> {
    const historyKey = `history_${domain}`
    return new Promise((resolve) => {
        chrome.storage.local.get([historyKey], (result) => {
            const existing: DomainHistory = result[historyKey] || { domain, entries: [], lastUpdated: 0 }
            const entry: HistoryEntry = {
                timestamp: data.timestamp,
                totalSize: data.totalSize,
                scriptCount: data.scripts.length,
                thirdPartySize: data.thirdPartySize
            }
            
            existing.entries.push(entry)
            existing.entries = existing.entries.filter(e => Date.now() - e.timestamp < 30 * 24 * 60 * 60 * 1000)
            existing.entries.sort((a, b) => b.timestamp - a.timestamp)
            existing.lastUpdated = Date.now()
            
            chrome.storage.local.set({ [historyKey]: existing }, () => resolve())
        })
    })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_ANALYSIS") {
        const url = message.url
        const domain = getDomainFromUrl(url)
        analysisCache.set(url, message.data)
        currentAnalysis = message.data
        
        scriptMonitor.push({
            src: url,
            action: "Analysis updated",
            timestamp: Date.now()
        })
        if (scriptMonitor.length > 100) {
            scriptMonitor.shift()
        }
        
        chrome.storage.local.set({ [url]: message.data }, () => {
            saveHistory(domain, message.data).then(() => {
                sendResponse({ success: true })
                sendToAPI(message.data).catch(() => {})
            })
        })
        return true
    } else if (message.type === "GET_ANALYSIS") {
        const url = message.url
        const cached = analysisCache.get(url)
        if (cached) {
            sendResponse({ data: cached })
        } else {
            chrome.storage.local.get([url], (result) => {
                if (result[url]) {
                    analysisCache.set(url, result[url])
                    sendResponse({ data: result[url] })
                } else {
                    sendResponse({ data: null })
                }
            })
            return true
        }
    } else if (message.type === "GET_HISTORY") {
        const domain = message.domain || getDomainFromUrl(message.url || "")
        const historyKey = `history_${domain}`
        chrome.storage.local.get([historyKey], (result) => {
            sendResponse({ data: result[historyKey] || null })
        })
        return true
    } else if (message.type === "GET_CURRENT_ANALYSIS") {
        sendResponse({ data: currentAnalysis })
        return true
    } else if (message.type === "GET_SCRIPTS_MONITOR") {
        sendResponse({ scripts: scriptMonitor.slice(-20) })
        return true
    } else if (message.type === "SCRIPT_INJECTED") {
        scriptMonitor.push({
            src: message.src || "inline",
            action: "Script injected",
            timestamp: Date.now()
        })
        if (scriptMonitor.length > 100) {
            scriptMonitor.shift()
        }
        return true
    } else if (message.type === "SCRIPT_REMOVED") {
        scriptMonitor.push({
            src: message.src || "inline",
            action: "Script removed",
            timestamp: Date.now()
        })
        if (scriptMonitor.length > 100) {
            scriptMonitor.shift()
        }
        return true
    }
    return false
})

async function sendToAPI(data: AnalysisData): Promise<void> {
    try {
        const result = await chrome.storage.sync.get(["tideSettings"])
        const settings = result.tideSettings
        if (!settings?.apiEnabled || !settings?.apiEndpoint) {
            return
        }

        const payload = {
            totalSize: data.totalSize,
            scriptCount: data.scripts.length,
            thirdPartySize: data.thirdPartySize,
            frameworks: data.frameworks.map(f => f.name),
            libraries: data.libraries.map(l => l.name),
            timestamp: data.timestamp
        }

        await fetch(settings.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
    } catch (error) {
        console.error("Failed to send data to API:", error)
    }
}

async function getPeerRecommendations(domain: string): Promise<string[]> {
    try {
        const result = await chrome.storage.sync.get(["tideSettings"])
        const settings = result.tideSettings
        if (!settings?.apiEnabled || !settings?.apiEndpoint) {
            return []
        }

        const response = await fetch(`${settings.apiEndpoint}/recommendations?domain=${encodeURIComponent(domain)}`)
        if (response.ok) {
            const data = await response.json()
            return data.recommendations || []
        }
    } catch (error) {
        console.error("Failed to get peer recommendations:", error)
    }
    return []
}

chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (details.type === "script" && details.responseHeaders) {
            const contentLength = details.responseHeaders.find(
                h => h.name.toLowerCase() === "content-length"
            )
            const contentEncoding = details.responseHeaders.find(
                h => h.name.toLowerCase() === "content-encoding"
            )

            if (contentLength) {
                const size = parseInt(contentLength.value, 10)
                const isGzipped = contentEncoding?.value?.includes("gzip")

                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: "SCRIPT_SIZE",
                            url: details.url,
                            size,
                            gzipped: isGzipped
                        }).catch(() => { })
                    }
                })
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
)

