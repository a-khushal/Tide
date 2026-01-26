import { useState, useEffect } from "react"
import "./popup.css"
import type { AnalysisData, DomainHistory, ScriptInfo } from "./types"
import { getRecommendations, getPeerComparisons, getCommunityData } from "./api"

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

function PieChart({ data, size = 80 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null
  
  let currentAngle = -90
  const center = size / 2
  const radius = size / 2 - 4
  
  const paths = data.map((item) => {
    const percentage = (item.value / total) * 100
    const angle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle
    
    const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180)
    const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180)
    const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180)
    const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180)
    const largeArc = angle > 180 ? 1 : 0
    
    return {
      path: `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      percentage,
      label: item.label,
      color: item.color,
      value: item.value
    }
  })
  
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="flex-shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.path} fill={p.color} stroke="#2d2d2d" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        {paths.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: p.color }} />
            <span className="text-[#b0b0b0]">{p.label}:</span>
            <span className="font-mono text-[#e8e8e8]">{p.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data, maxValue }: { data: Array<{ label: string; value: number; color: string }>; maxValue: number }) {
  if (data.length === 0 || maxValue === 0) return null
  
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((item, i) => {
        const width = (item.value / maxValue) * 100
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="text-[10px] text-[#808080] w-16 truncate font-mono" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 h-4 bg-[#363636] border border-[#404040] rounded overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${width}%`,
                  backgroundColor: item.color,
                  transition: "width 0.3s ease"
                }}
              />
            </div>
            <div className="text-[10px] font-mono text-[#b0b0b0] w-12 text-right">
              {formatBytes(item.value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimelineChart({ scripts }: { scripts: ScriptInfo[] }) {
  if (scripts.length === 0) return null
  
  const sortedScripts = [...scripts].sort((a, b) => a.loadTime - b.loadTime)
  const maxTime = Math.max(...sortedScripts.map(s => s.loadTime + s.parseTime), 1)
  const timelineScripts = sortedScripts.slice(0, 15)
  
  return (
    <div className="relative">
      <div className="text-[10px] text-[#808080] mb-2">Load Timeline (ms)</div>
      <div className="relative h-32 bg-[#363636] border border-[#404040] rounded p-2">
        {timelineScripts.map((script, i) => {
          const startPercent = (script.loadTime / maxTime) * 100
          const widthPercent = ((script.loadTime + script.parseTime) / maxTime) * 100 - startPercent
          const fileName = script.src.split("/").pop() || script.src
          const color = script.firstParty ? "#7db3d3" : "#d4a574"
          
          return (
            <div
              key={i}
              className="absolute bottom-0 border border-[#404040] rounded"
              style={{
                left: `${startPercent}%`,
                width: `${Math.max(widthPercent, 2)}%`,
                height: `${20 + (i % 3) * 8}px`,
                backgroundColor: color,
                opacity: 0.7
              }}
              title={`${fileName}: ${formatTime(script.loadTime)} - ${formatTime(script.loadTime + script.parseTime)}`}
            />
          )
        })}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#404040]" />
        <div className="absolute bottom-0 left-0 text-[8px] text-[#808080]">0ms</div>
        <div className="absolute bottom-0 right-0 text-[8px] text-[#808080]">{formatTime(maxTime)}</div>
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-[#808080]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#7db3d3", opacity: 0.7 }} />
          <span>First-party</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#d4a574", opacity: 0.7 }} />
          <span>Third-party</span>
        </div>
      </div>
    </div>
  )
}

function generateRecommendations(analysis: AnalysisData): string[] {
  const recommendations: string[] = []
  
  if (analysis.totalSize > 2 * 1024 * 1024) {
    recommendations.push("Total JS size exceeds 2MB. Consider code splitting and lazy loading.")
  }
  
  if (analysis.thirdPartySize > analysis.totalSize * 0.5) {
    recommendations.push("Third-party scripts account for more than 50% of total size. Review and remove unused dependencies.")
  }
  
  if (analysis.performance.longTasks > 5) {
    recommendations.push("High number of long tasks detected. Consider breaking up heavy computations.")
  }
  
  if (analysis.performance.mainThreadBlockingTime > 300) {
    recommendations.push("Main thread blocking time is high. Optimize synchronous operations and use web workers.")
  }
  
  const unusedCount = analysis.scripts.filter(s => s.potentiallyUnused).length
  if (unusedCount > 0) {
    recommendations.push(`${unusedCount} potentially unused scripts detected. Verify and remove if unnecessary.`)
  }
  
  if (analysis.securityIssues.length > 0) {
    const highSeverity = analysis.securityIssues.filter(i => i.severity === "high").length
    if (highSeverity > 0) {
      recommendations.push(`${highSeverity} high-severity security issues found. Address immediately.`)
    }
  }
  
  const nonAsyncScripts = analysis.scripts.filter(s => !s.async && !s.defer && !s.module).length
  if (nonAsyncScripts > 3) {
    recommendations.push("Multiple blocking scripts detected. Use async/defer attributes to improve load performance.")
  }
  
  if (analysis.totalGzippedSize / analysis.totalSize > 0.4) {
    recommendations.push("Compression ratio is low. Ensure gzip/brotli compression is enabled on the server.")
  }
  
  return recommendations
}

function generateOptimizationTips(analysis: AnalysisData): string[] {
  const tips: string[] = []
  
  if (analysis.totalSize > 1024 * 1024) {
    tips.push("Use dynamic imports for code splitting")
    tips.push("Implement route-based lazy loading")
    tips.push("Consider tree-shaking unused code")
  }
  
  if (analysis.thirdPartySize > 0) {
    tips.push("Audit third-party scripts regularly")
    tips.push("Use resource hints (preconnect, dns-prefetch) for CDN resources")
    tips.push("Consider self-hosting critical third-party libraries")
  }
  
  if (analysis.performance.scriptParseTime > 100) {
    tips.push("Reduce parse time by minimizing inline scripts")
    tips.push("Use module scripts to enable better caching")
  }
  
  if (analysis.scripts.length > 20) {
    tips.push("Bundle scripts to reduce HTTP requests")
    tips.push("Use HTTP/2 server push for critical resources")
  }
  
  return tips
}

function exportAsJSON(analysis: AnalysisData, history: DomainHistory | null, url: string) {
  const recommendations = generateRecommendations(analysis)
  const optimizationTips = generateOptimizationTips(analysis)
  
  const report = {
    url,
    timestamp: new Date().toISOString(),
    analysis: {
      ...analysis,
      timestamp: new Date(analysis.timestamp).toISOString()
    },
    history: history ? {
      ...history,
      lastUpdated: new Date(history.lastUpdated).toISOString(),
      entries: history.entries.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp).toISOString()
      }))
    } : null,
    recommendations,
    optimizationTips,
    summary: {
      totalSize: formatBytes(analysis.totalSize),
      totalGzippedSize: formatBytes(analysis.totalGzippedSize),
      scriptCount: analysis.scripts.length,
      thirdPartyPercentage: ((analysis.thirdPartySize / analysis.totalSize) * 100).toFixed(1) + "%",
      frameworks: analysis.frameworks.map(f => f.name).join(", "),
      libraries: analysis.libraries.map(l => l.name).join(", ")
    }
  }
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  const url_blob = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url_blob
  a.download = `tide-report-${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url_blob)
}

function exportAsText(analysis: AnalysisData, history: DomainHistory | null, url: string) {
  const recommendations = generateRecommendations(analysis)
  const optimizationTips = generateOptimizationTips(analysis)
  
  let report = `TIDE - JavaScript Analysis Report\n`
  report += `Generated: ${new Date().toISOString()}\n`
  report += `URL: ${url}\n\n`
  report += `=== SUMMARY ===\n`
  report += `Total Size: ${formatBytes(analysis.totalSize)}\n`
  report += `Gzipped Size: ${formatBytes(analysis.totalGzippedSize)}\n`
  report += `Scripts: ${analysis.scripts.length}\n`
  report += `Third-Party: ${formatBytes(analysis.thirdPartySize)} (${((analysis.thirdPartySize / analysis.totalSize) * 100).toFixed(1)}%)\n`
  report += `First-Party: ${formatBytes(analysis.firstPartySize)} (${((analysis.firstPartySize / analysis.totalSize) * 100).toFixed(1)}%)\n\n`
  
  if (analysis.frameworks.length > 0) {
    report += `=== FRAMEWORKS ===\n`
    analysis.frameworks.forEach(f => {
      report += `- ${f.name}${f.version ? ` v${f.version}` : ""}\n`
    })
    report += `\n`
  }
  
  if (analysis.libraries.length > 0) {
    report += `=== LIBRARIES ===\n`
    analysis.libraries.forEach(l => {
      report += `- ${l.name}${l.version ? ` v${l.version}` : ""}\n`
    })
    report += `\n`
  }
  
  report += `=== PERFORMANCE ===\n`
  report += `Long Tasks: ${analysis.performance.longTasks}\n`
  report += `Time to Interactive: ${formatTime(analysis.performance.timeToInteractive)}\n`
  report += `Load Time: ${formatTime(analysis.performance.scriptLoadTime)}\n`
  report += `Parse Time: ${formatTime(analysis.performance.scriptParseTime)}\n`
  if (analysis.performance.mainThreadBlockingTime > 0) {
    report += `Main Thread Blocking: ${formatTime(analysis.performance.mainThreadBlockingTime)}\n`
  }
  report += `\n`
  
  if (recommendations.length > 0) {
    report += `=== RECOMMENDATIONS ===\n`
    recommendations.forEach((rec, i) => {
      report += `${i + 1}. ${rec}\n`
    })
    report += `\n`
  }
  
  if (optimizationTips.length > 0) {
    report += `=== OPTIMIZATION TIPS ===\n`
    optimizationTips.forEach((tip, i) => {
      report += `${i + 1}. ${tip}\n`
    })
    report += `\n`
  }
  
  if (analysis.securityIssues.length > 0) {
    report += `=== SECURITY ISSUES ===\n`
    analysis.securityIssues.forEach(issue => {
      report += `[${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}\n`
      if (issue.script) report += `  Script: ${issue.script}\n`
    })
    report += `\n`
  }
  
  if (analysis.scripts.length > 0) {
    report += `=== TOP SCRIPTS BY SIZE ===\n`
    const topScripts = [...analysis.scripts].sort((a, b) => b.size - a.size).slice(0, 10)
    topScripts.forEach((script, i) => {
      const fileName = script.src.split("/").pop() || script.src
      const percentage = ((script.size / analysis.totalSize) * 100).toFixed(1)
      report += `${i + 1}. ${fileName} - ${formatBytes(script.size)} (${percentage}%)\n`
      report += `   Host: ${script.host}\n`
      report += `   ${script.firstParty ? "First-party" : "Third-party"}${script.isCDN ? ", CDN" : ""}\n`
    })
  }
  
  const blob = new Blob([report], { type: "text/plain" })
  const url_blob = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url_blob
  a.download = `tide-report-${new Date().toISOString().split("T")[0]}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url_blob)
}

function IndexPopup() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<DomainHistory | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string>("")

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
              setCurrentUrl(tab.url)
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
                      setCurrentUrl(tab.url || "")
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

  const handleExportJSON = () => {
    if (analysis && currentUrl) {
      exportAsJSON(analysis, history, currentUrl)
    }
  }

  const handleExportText = () => {
    if (analysis && currentUrl) {
      exportAsText(analysis, history, currentUrl)
    }
  }

  return (
    <div className="p-4 w-[320px] h-[480px] overflow-y-auto box-border bg-[#2d2d2d]">
      <div className="flex items-center justify-between mb-5 border-b border-[#404040] pb-2">
        <h2 className="m-0 text-base font-semibold text-[#e8e8e8]">Tide</h2>
        {analysis && (
          <div className="flex gap-1">
            <button
              onClick={handleExportJSON}
              className="px-2 py-1 text-[10px] bg-[#363636] border border-[#404040] rounded text-[#b0b0b0] hover:bg-[#404040] hover:text-[#e8e8e8] transition-colors"
              title="Export as JSON"
            >
              JSON
            </button>
            <button
              onClick={handleExportText}
              className="px-2 py-1 text-[10px] bg-[#363636] border border-[#404040] rounded text-[#b0b0b0] hover:bg-[#404040] hover:text-[#e8e8e8] transition-colors"
              title="Export as Text"
            >
              TXT
            </button>
          </div>
        )}
      </div>

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
        <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
          Size Distribution
        </h3>
        <div className="p-3 bg-[#363636] border border-[#404040] rounded">
          {(() => {
            const frameworkSize = analysis.frameworks.reduce((sum, fw) => {
              const fwScripts = analysis.scripts.filter(s => 
                s.src.toLowerCase().includes(fw.name.toLowerCase()) ||
                s.host.toLowerCase().includes(fw.name.toLowerCase())
              )
              return sum + fwScripts.reduce((s, script) => s + script.size, 0)
            }, 0)
            
            const librarySize = analysis.libraries.reduce((sum, lib) => {
              const libScripts = analysis.scripts.filter(s =>
                s.src.toLowerCase().includes(lib.name.toLowerCase()) ||
                s.host.toLowerCase().includes(lib.name.toLowerCase())
              )
              return sum + libScripts.reduce((s, script) => s + script.size, 0)
            }, 0)
            
            const appCodeSize = Math.max(0, analysis.totalSize - frameworkSize - librarySize - analysis.thirdPartySize)
            
            const pieData = [
              { label: "App Code", value: appCodeSize, color: "#7db3d3" },
              { label: "Frameworks", value: frameworkSize, color: "#7db892" },
              { label: "Libraries", value: librarySize, color: "#d4a574" },
              { label: "Third-party", value: analysis.thirdPartySize, color: "#d4a5a5" }
            ].filter(d => d.value > 0)
            
            return <PieChart data={pieData} size={100} />
          })()}
        </div>
      </section>

      {topScripts.length > 0 && (
        <section className="mb-5">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
            Top Scripts (Bar Chart)
          </h3>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <BarChart
              data={topScripts.map(script => {
                const fileName = script.src.split("/").pop() || script.src
                return {
                  label: fileName.length > 12 ? fileName.substring(0, 12) + "..." : fileName,
                  value: script.size,
                  color: script.firstParty ? "#7db3d3" : "#d4a574"
                }
              })}
              maxValue={topScripts[0]?.size || 1}
            />
          </div>
        </section>
      )}

      {analysis.scripts.length > 0 && (
        <section className="mb-5">
          <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">
            Script Load Timeline
          </h3>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <TimelineChart scripts={analysis.scripts} />
          </div>
        </section>
      )}

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

      {analysis && (() => {
        const recommendations = generateRecommendations(analysis)
        const optimizationTips = generateOptimizationTips(analysis)
        
        if (recommendations.length === 0 && optimizationTips.length === 0) return null
        
        return (
          <section className="mt-4">
            <h3 className="m-0 mb-2 text-xs font-semibold text-[#b0b0b0] uppercase tracking-wide">Recommendations</h3>
            {recommendations.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-[#808080] mb-1.5 uppercase tracking-wide">Performance</div>
                <div className="flex flex-col gap-1.5">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="p-2 bg-[#1e3a5f] border border-[#4a7ba7] rounded text-xs text-[#7db3d3]">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {optimizationTips.length > 0 && (
              <div>
                <div className="text-[10px] text-[#808080] mb-1.5 uppercase tracking-wide">Optimization Tips</div>
                <div className="flex flex-col gap-1.5">
                  {optimizationTips.map((tip, idx) => (
                    <div key={idx} className="p-2 bg-[#1e3a2e] border border-[#4a7c5a] rounded text-xs text-[#7db892]">
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      })()}
    </div>
  )
}

export default IndexPopup

