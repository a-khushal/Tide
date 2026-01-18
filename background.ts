import type { AnalysisData } from "./types"
const analysisCache = new Map<string, AnalysisData>()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_ANALYSIS") {
        const url = message.url
        analysisCache.set(url, message.data)
        chrome.storage.local.set({ [url]: message.data }, () => {
            sendResponse({ success: true })
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
    }
    return false
})

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

