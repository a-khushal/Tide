import { useState, useEffect } from "react"
import "./popup.css"
import type { AnalysisData } from "./types"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function formatTime(ms: number): string {
  if (ms < 1000) return Math.round(ms) + " ms"
  return (Math.round(ms / 100) / 10).toFixed(1) + " s"
}

function IndexPopup() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab.id || !tab.url) {
          setError("No active tab found")
          setLoading(false)
          return
        }

        chrome.runtime.sendMessage(
          { type: "GET_ANALYSIS", url: tab.url },
          async (response) => {
            if (chrome.runtime.lastError) {
              setError("Extension error: " + chrome.runtime.lastError.message)
              setLoading(false)
              return
            }

            if (response?.data) {
              setAnalysis(response.data)
              setLoading(false)
              return
            }

            if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://") || tab.url?.startsWith("moz-extension://")) {
              setError("Cannot analyze Chrome internal pages or extension pages.")
              setLoading(false)
              return
            }

            console.log("Popup: Requesting analysis from content script for tab", tab.id)
            chrome.tabs.sendMessage(tab.id!, { type: "REQUEST_ANALYSIS" }, (msgResponse) => {
              if (chrome.runtime.lastError) {
                console.error("Popup: Failed to send message to content script:", chrome.runtime.lastError)
                setError("Content script not available. Please refresh the page and try again.")
                setLoading(false)
                return
              }
              console.log("Popup: Content script responded:", msgResponse)

              let attempts = 0
              const maxAttempts = 20

              const pollForData = () => {
                attempts++
                chrome.runtime.sendMessage(
                  { type: "GET_ANALYSIS", url: tab.url },
                  (pollResponse) => {
                    if (chrome.runtime.lastError) {
                      setError("Failed to get analysis data")
                      setLoading(false)
                      return
                    }

                    if (pollResponse?.data) {
                      setAnalysis(pollResponse.data)
                      setLoading(false)
                    } else if (attempts < maxAttempts) {
                      setTimeout(pollForData, 300)
                    } else {
                      setError("Analysis timed out. Please try again.")
                      setLoading(false)
                    }
                  }
                )
              }

              setTimeout(pollForData, 500)
            })
          }
        )
      } catch (err) {
        setError("Failed to analyze page")
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [])

  if (loading) {
    return (
      <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border">
        <h2 className="m-0 mb-4">Analyzing page...</h2>
        <div>Collecting JavaScript metrics...</div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border">
        <h2 className="m-0 mb-4">Tide</h2>
        <div className="text-[#d32f2f]">{error || "No data available"}</div>
        <div className="mt-2 text-xs text-[#666]">
          Try refreshing the page and opening this popup again.
        </div>
      </div>
    )
  }

  const topScripts = [...analysis.scripts]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)

  const totalSize = analysis.totalSize ?? 0
  const thirdPartySize = analysis.thirdPartySize ?? 0
  const thirdPartyCount = analysis.thirdPartyCount ?? 0
  const cdnSize = analysis.cdnSize ?? 0
  const cdnCount = analysis.cdnCount ?? 0
  const firstPartySize = analysis.firstPartySize ?? Math.max(0, totalSize - thirdPartySize)
  const firstPartyCount =
    analysis.firstPartyCount ?? (analysis.scripts?.filter((s) => s.firstParty).length || 0)

  const topThirdParty = analysis.scripts
    .filter((s) => !s.firstParty)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)

  const getHost = (src: string, host?: string) => {
    if (host) return host
    try {
      return new URL(src).hostname
    } catch {
      return src
    }
  }

  return (
    <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border">
      <h2 className="m-0 mb-5 text-xl">Tide</h2>

      <section className="mb-6">
        <h3 className="m-0 mb-3 text-base font-semibold">
          Size Tracking
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#f5f5f5] rounded">
            <div className="text-xs text-[#666] mb-1">Total Size</div>
            <div className="text-lg font-semibold">{formatBytes(analysis.totalSize)}</div>
          </div>
          <div className="p-3 bg-[#f5f5f5] rounded">
            <div className="text-xs text-[#666] mb-1">Gzipped</div>
            <div className="text-lg font-semibold">{formatBytes(analysis.totalGzippedSize)}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-[#666]">
          {analysis.scripts.length} script{analysis.scripts.length !== 1 ? "s" : ""} detected
        </div>
      </section>

      <section className="mb-6">
        <h3 className="m-0 mb-3 text-base font-semibold">Third-Party Analysis</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#eef2ff] rounded">
            <div className="text-xs text-[#666] mb-1">Third-party size</div>
            <div className="text-lg font-semibold">{formatBytes(thirdPartySize)}</div>
            <div className="text-[11px] text-[#666]">
              {thirdPartyCount} script{thirdPartyCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="p-3 bg-[#eef2ff] rounded">
            <div className="text-xs text-[#666] mb-1">CDN size</div>
            <div className="text-lg font-semibold">{formatBytes(cdnSize)}</div>
            <div className="text-[11px] text-[#666]">
              {cdnCount} CDN script{cdnCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-[#666]">
          First-party: {formatBytes(firstPartySize)} ({firstPartyCount})
        </div>
      </section>

      {analysis.frameworks.length > 0 && (
        <section className="mb-6">
          <h3 className="m-0 mb-3 text-base font-semibold">
            Frameworks
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.frameworks.map((fw) => (
              <div
                key={fw.name}
                className="px-3 py-2 bg-[#e3f2fd] rounded text-sm"
              >
                <div className="font-semibold">{fw.name}</div>
                {fw.version && (
                  <div className="text-[11px] text-[#666] mt-0.5">
                    v{fw.version}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {analysis.libraries.length > 0 && (
        <section className="mb-6">
          <h3 className="m-0 mb-3 text-base font-semibold">
            Top Libraries
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.libraries.map((lib) => (
              <div
                key={lib.name}
                className="px-3 py-2 bg-[#f3e5f5] rounded text-sm"
              >
                <div className="font-semibold">{lib.name}</div>
                {lib.version && (
                  <div className="text-[11px] text-[#666] mt-0.5">
                    v{lib.version}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h3 className="m-0 mb-3 text-base font-semibold">
          Performance Metrics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[#fff3e0] rounded">
            <div className="text-xs text-[#666] mb-1">Long Tasks</div>
            <div className="text-lg font-semibold">{analysis.performance.longTasks}</div>
          </div>
          <div className="p-3 bg-[#fff3e0] rounded">
            <div className="text-xs text-[#666] mb-1">TTI</div>
            <div className="text-lg font-semibold">
              {formatTime(analysis.performance.timeToInteractive)}
            </div>
          </div>
          <div className="p-3 bg-[#fff3e0] rounded">
            <div className="text-xs text-[#666] mb-1">Load Time</div>
            <div className="text-lg font-semibold">
              {formatTime(analysis.performance.scriptLoadTime)}
            </div>
          </div>
          <div className="p-3 bg-[#fff3e0] rounded">
            <div className="text-xs text-[#666] mb-1">Parse Time</div>
            <div className="text-lg font-semibold">
              {formatTime(analysis.performance.scriptParseTime)}
            </div>
          </div>
        </div>
        {analysis.performance.mainThreadBlockingTime > 0 && (
          <div className="mt-3 p-3 bg-[#ffebee] rounded">
            <div className="text-xs text-[#666] mb-1">
              Main Thread Blocking
            </div>
            <div className="text-base font-semibold text-[#c62828]">
              {formatTime(analysis.performance.mainThreadBlockingTime)}
            </div>
          </div>
        )}
      </section>

      {topScripts.length > 0 && (
        <section>
          <h3 className="m-0 mb-3 text-base font-semibold">
            Top Scripts by Size
          </h3>
          <div className="flex flex-col gap-2">
            {topScripts.map((script, idx) => {
              const percentage = analysis.totalSize > 0 ? (script.size / analysis.totalSize) * 100 : 0
              const fileName = script.src.split("/").pop() || script.src
              return (
                <div
                  key={idx}
                  className="p-3 bg-[#f5f5f5] rounded text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold mb-1 break-all">{fileName}</div>
                    <div className="flex gap-1 text-[10px]">
                      <span className={`px-2 py-0.5 rounded ${script.firstParty ? "bg-[#e0f2fe] text-[#0369a1]" : "bg-[#fef3c7] text-[#b45309]"}`}>
                        {script.firstParty ? "First" : "Third"}
                      </span>
                      {script.isCDN && <span className="px-2 py-0.5 rounded bg-[#ede9fe] text-[#6b21a8]">CDN</span>}
                      {script.module && <span className="px-2 py-0.5 rounded bg-[#f0f9ff] text-[#075985]">module</span>}
                      {script.async && <span className="px-2 py-0.5 rounded bg-[#ecfdf3] text-[#15803d]">async</span>}
                      {script.defer && <span className="px-2 py-0.5 rounded bg-[#ecfdf3] text-[#166534]">defer</span>}
                    </div>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>{formatBytes(script.size)}</span>
                    <span className="text-[#666]">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="text-[11px] text-[#666]">
                    Host: {getHost(script.src, script.host)}
                  </div>
                  <div className="text-[11px] text-[#666]">
                    Gzipped: {formatBytes(script.gzippedSize)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {topThirdParty.length > 0 && (
        <section className="mt-4">
          <h3 className="m-0 mb-3 text-base font-semibold">
            Top Third-Party Scripts
          </h3>
          <div className="flex flex-col gap-2">
            {topThirdParty.map((script, idx) => {
              const percentage = analysis.totalSize > 0 ? (script.size / analysis.totalSize) * 100 : 0
              const fileName = script.src.split("/").pop() || script.src
              return (
                <div key={idx} className="p-3 bg-[#fff7ed] rounded text-xs">
                  <div className="font-semibold mb-1 break-all">{fileName}</div>
                  <div className="flex justify-between mb-1">
                    <span>{formatBytes(script.size)}</span>
                    <span className="text-[#666]">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="text-[11px] text-[#666]">Host: {getHost(script.src, script.host)}</div>
                  <div className="text-[11px] text-[#666]">Gzipped: {formatBytes(script.gzippedSize)}</div>
                  <div className="flex gap-1 mt-1 text-[10px]">
                    {script.isCDN && <span className="px-2 py-0.5 rounded bg-[#ede9fe] text-[#6b21a8]">CDN</span>}
                    {script.module && <span className="px-2 py-0.5 rounded bg-[#f0f9ff] text-[#075985]">module</span>}
                    {script.async && <span className="px-2 py-0.5 rounded bg-[#ecfdf3] text-[#15803d]">async</span>}
                    {script.defer && <span className="px-2 py-0.5 rounded bg-[#ecfdf3] text-[#166534]">defer</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default IndexPopup
