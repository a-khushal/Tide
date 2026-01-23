import { useState, useEffect } from "react"
import "./popup.css"
import type { AnalysisData, DomainHistory } from "./types"

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
  const [history, setHistory] = useState<DomainHistory | null>(null)

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
                      const domain = tab.url ? new URL(tab.url).hostname : ""
                      chrome.runtime.sendMessage({ type: "GET_HISTORY", domain }, (histResponse) => {
                        if (histResponse?.data) {
                          setHistory(histResponse.data)
                        }
                      })
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
      <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border bg-[#2d2d2d]">
        <h2 className="m-0 mb-4 text-base font-semibold text-[#e8e8e8] border-b border-[#404040] pb-2">Tide</h2>
        <div className="text-sm text-[#b0b0b0]">Analyzing page...</div>
        <div className="mt-1 text-xs text-[#808080]">Collecting JavaScript metrics...</div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border bg-[#2d2d2d]">
        <h2 className="m-0 mb-4 text-base font-semibold text-[#e8e8e8] border-b border-[#404040] pb-2">Tide</h2>
        <div className="p-3 bg-[#3a2d1a] border border-[#8b6914] rounded">
          <div className="text-sm text-[#d4a574] font-medium mb-1">{error || "No data available"}</div>
          <div className="text-xs text-[#808080]">
            Try refreshing the page and opening this popup again.
          </div>
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
  const unusedScripts = analysis.scripts.filter((s) => s.potentiallyUnused)
  const topUnused = unusedScripts.sort((a, b) => b.size - a.size).slice(0, 5)

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
    <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border bg-[#2d2d2d]">
      <h2 className="m-0 mb-5 text-base font-semibold text-[#e8e8e8] border-b border-[#404040] pb-2">Tide</h2>

      <section className="mb-5">
        <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
          Size Tracking
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">Total Size</div>
            <div className="text-base font-mono font-semibold text-[#e8e8e8]">{formatBytes(analysis.totalSize)}</div>
          </div>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">Gzipped</div>
            <div className="text-base font-mono font-semibold text-[#e8e8e8]">{formatBytes(analysis.totalGzippedSize)}</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-[#b0b0b0]">
          {analysis.scripts.length} script{analysis.scripts.length !== 1 ? "s" : ""} detected
        </div>
      </section>

      <section className="mb-5">
        <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">Third-Party Analysis</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">Third-party</div>
            <div className="text-base font-mono font-semibold text-[#e8e8e8]">{formatBytes(thirdPartySize)}</div>
            <div className="text-[10px] text-[#b0b0b0] mt-1">
              {thirdPartyCount} script{thirdPartyCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">CDN</div>
            <div className="text-base font-mono font-semibold text-[#e8e8e8]">{formatBytes(cdnSize)}</div>
            <div className="text-[10px] text-[#b0b0b0] mt-1">
              {cdnCount} script{cdnCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="mt-2 p-2 bg-[#363636] border border-[#404040] rounded">
          <div className="text-xs text-[#b0b0b0]">
            First-party: <span className="font-mono font-semibold text-[#e8e8e8]">{formatBytes(firstPartySize)}</span> ({firstPartyCount})
          </div>
        </div>
      </section>

      {analysis.frameworks.length > 0 && (
        <section className="mb-5">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
            Frameworks
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {analysis.frameworks.map((fw) => (
              <div
                key={fw.name}
                className="px-2 py-1 bg-[#1e3a5f] border border-[#4a7ba7] rounded text-xs text-[#7db3d3]"
              >
                <span className="font-medium">{fw.name}</span>
                {fw.version && (
                  <span className="ml-1 font-mono text-[10px] opacity-75">v{fw.version}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {analysis.libraries.length > 0 && (
        <section className="mb-5">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
            Top Libraries
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {analysis.libraries.map((lib) => (
              <div
                key={lib.name}
                className="px-2 py-1 bg-[#1e3a2e] border border-[#4a7c5a] rounded text-xs text-[#7db892]"
              >
                <span className="font-medium">{lib.name}</span>
                {lib.version && (
                  <span className="ml-1 font-mono text-[10px] opacity-75">v{lib.version}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-5">
        <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
          Performance Metrics
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">Long Tasks</div>
            <div className="text-sm font-mono font-semibold text-[#e8e8e8]">{analysis.performance.longTasks}</div>
          </div>
          <div className="p-2 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">TTI</div>
            <div className="text-sm font-mono font-semibold text-[#e8e8e8]">
              {formatTime(analysis.performance.timeToInteractive)}
            </div>
          </div>
          <div className="p-2 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">Load Time</div>
            <div className="text-sm font-mono font-semibold text-[#e8e8e8]">
              {formatTime(analysis.performance.scriptLoadTime)}
            </div>
          </div>
          <div className="p-2 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-1 uppercase tracking-wide">Parse Time</div>
            <div className="text-sm font-mono font-semibold text-[#e8e8e8]">
              {formatTime(analysis.performance.scriptParseTime)}
            </div>
          </div>
        </div>
        {analysis.performance.mainThreadBlockingTime > 0 && (
          <div className="mt-2 p-2 bg-[#3a2d1a] border border-[#8b6914] rounded">
            <div className="text-[10px] text-[#d4a574] mb-1 uppercase tracking-wide font-medium">
              Main Thread Blocking
            </div>
            <div className="text-sm font-mono font-semibold text-[#d4a574]">
              {formatTime(analysis.performance.mainThreadBlockingTime)}
            </div>
          </div>
        )}
      </section>

      {topScripts.length > 0 && (
        <section>
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
            Top Scripts by Size
          </h3>
          <div className="flex flex-col gap-1.5">
            {topScripts.map((script, idx) => {
              const percentage = analysis.totalSize > 0 ? (script.size / analysis.totalSize) * 100 : 0
              const fileName = script.src.split("/").pop() || script.src
  return (
    <div
                  key={idx}
                  className="p-2 bg-[#363636] border border-[#404040] rounded text-xs"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-medium break-all text-[#e8e8e8]">{fileName}</div>
                    <div className="flex gap-1 text-[9px] flex-shrink-0">
                      <span className={`px-1.5 py-0.5 rounded border ${script.firstParty ? "bg-[#1e3a5f] border-[#4a7ba7] text-[#7db3d3]" : "bg-[#3a2d1a] border-[#8b6914] text-[#d4a574]"}`}>
                        {script.firstParty ? "1st" : "3rd"}
                      </span>
                      {script.isCDN && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">CDN</span>}
                      {script.module && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">M</span>}
                      {script.async && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">A</span>}
                      {script.defer && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">D</span>}
                    </div>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-[#e8e8e8]">{formatBytes(script.size)}</span>
                    <span className="text-[#b0b0b0]">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="text-[10px] text-[#808080] font-mono">
                    {getHost(script.src, script.host)}
                  </div>
                  <div className="text-[10px] text-[#808080]">
                    Gzipped: <span className="font-mono">{formatBytes(script.gzippedSize)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {topThirdParty.length > 0 && (
        <section className="mt-4">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
            Top Third-Party Scripts
          </h3>
          <div className="flex flex-col gap-1.5">
            {topThirdParty.map((script, idx) => {
              const percentage = analysis.totalSize > 0 ? (script.size / analysis.totalSize) * 100 : 0
              const fileName = script.src.split("/").pop() || script.src
              return (
                <div key={idx} className="p-2 bg-[#3a2d1a] border border-[#8b6914] rounded text-xs">
                  <div className="font-medium mb-1 break-all text-[#e8e8e8]">{fileName}</div>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-[#e8e8e8]">{formatBytes(script.size)}</span>
                    <span className="text-[#b0b0b0]">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="text-[10px] text-[#808080] font-mono">{getHost(script.src, script.host)}</div>
                  <div className="text-[10px] text-[#808080]">
                    Gzipped: <span className="font-mono">{formatBytes(script.gzippedSize)}</span>
                  </div>
                  <div className="flex gap-1 mt-1 text-[9px]">
                    {script.isCDN && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">CDN</span>}
                    {script.module && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">M</span>}
                    {script.async && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">A</span>}
                    {script.defer && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">D</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {topUnused.length > 0 && (
        <section className="mt-4">
          <h3 className="m-0 mb-1 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">Potentially Unused</h3>
          <div className="text-[10px] text-[#d4a574] bg-[#3a2d1a] border border-[#8b6914] rounded p-1.5 mb-2">
            True dead code analysis requires build-time tools; this is runtime detection only.
          </div>
          <div className="flex flex-col gap-1.5">
            {topUnused.map((script, idx) => {
              const fileName = script.src.split("/").pop() || script.src
              const percentage = totalSize > 0 ? (script.size / totalSize) * 100 : 0
              return (
                <div key={idx} className="p-2 bg-[#3a2d1a] border border-[#8b6914] rounded text-xs">
                  <div className="font-medium mb-1 break-all text-[#e8e8e8]">{fileName}</div>
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-[#e8e8e8]">{formatBytes(script.size)}</span>
                    <span className="text-[#b0b0b0]">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="text-[10px] text-[#808080] font-mono">{getHost(script.src, script.host)}</div>
                  <div className="flex gap-1 mt-1 text-[9px]">
                    {script.isCDN && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">CDN</span>}
                    {script.module && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">M</span>}
                    {script.async && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">A</span>}
                    {script.defer && <span className="px-1.5 py-0.5 rounded bg-[#363636] border border-[#404040] text-[#b0b0b0]">D</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {analysis.securityIssues && analysis.securityIssues.length > 0 && (
        <section className="mt-4">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">Security Issues</h3>
          <div className="flex flex-col gap-1.5">
            {analysis.securityIssues.map((issue, idx) => {
              const severityColor = issue.severity === "high" ? "bg-[#3a1f1f] border-[#8b4a4a] text-[#d4a5a5]" : 
                                    issue.severity === "medium" ? "bg-[#3a2d1a] border-[#8b6914] text-[#d4a574]" : 
                                    "bg-[#1e3a5f] border-[#4a7ba7] text-[#7db3d3]"
              return (
                <div key={idx} className={`p-2 rounded border text-xs ${severityColor}`}>
                  <div className="font-semibold mb-1 text-[10px] uppercase tracking-wide">{issue.type.replace("_", " ")}</div>
                  <div className="text-[11px]">{issue.message}</div>
                  {issue.script && (
                    <div className="text-[10px] mt-1 break-all font-mono opacity-75">{issue.script}</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {history && history.entries.length > 0 && (
        <section className="mt-4">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">History & Trends</h3>
          <div className="text-xs text-[#808080] mb-2">
            Last 30 days ({history.entries.length} entries)
          </div>
          {history.entries.length >= 2 && (() => {
            const latest = history.entries[0]
            const previous = history.entries[1]
            const sizeDiff = latest.totalSize - previous.totalSize
            const sizePercent = previous.totalSize > 0 ? ((sizeDiff / previous.totalSize) * 100).toFixed(1) : "0"
            const scriptDiff = latest.scriptCount - previous.scriptCount
            return (
              <div className="p-2 bg-[#363636] border border-[#404040] rounded text-xs mb-2">
                <div className="mb-2">
                  <div className="text-[10px] text-[#808080] mb-0.5 uppercase tracking-wide">Size change</div>
                  <div className={`font-mono font-semibold ${sizeDiff > 0 ? "text-[#d4a5a5]" : sizeDiff < 0 ? "text-[#7db892]" : "text-[#e8e8e8]"}`}>
                    {sizeDiff > 0 ? "+" : ""}{formatBytes(sizeDiff)} ({sizePercent}%)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#808080] mb-0.5 uppercase tracking-wide">Script count change</div>
                  <div className={`font-mono font-semibold ${scriptDiff > 0 ? "text-[#d4a5a5]" : scriptDiff < 0 ? "text-[#7db892]" : "text-[#e8e8e8]"}`}>
                    {scriptDiff > 0 ? "+" : ""}{scriptDiff} scripts
                  </div>
                </div>
              </div>
            )
          })()}
          <div className="p-2 bg-[#363636] border border-[#404040] rounded">
            <div className="text-[10px] text-[#808080] mb-0.5 uppercase tracking-wide">Average</div>
            <div className="text-xs font-mono font-semibold text-[#e8e8e8]">
              {formatBytes(Math.round(history.entries.reduce((sum, e) => sum + e.totalSize, 0) / history.entries.length))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default IndexPopup

