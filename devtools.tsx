import { useState, useEffect } from "react"
import type { AnalysisData } from "./types"
import "./popup.css"

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

export default function DevToolsPanel() {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [scripts, setScripts] = useState<any[]>([])
  const [memory, setMemory] = useState<any>(null)
  const [isMonitoring, setIsMonitoring] = useState(true)

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "devtools-panel" })

    const updateAnalysis = () => {
      chrome.runtime.sendMessage({ type: "GET_CURRENT_ANALYSIS" }, (response) => {
        if (response?.data) {
          setAnalysis(response.data)
        }
      })
    }

    const updateScripts = () => {
      chrome.runtime.sendMessage({ type: "GET_SCRIPTS_MONITOR" }, (response) => {
        if (response?.scripts) {
          setScripts(response.scripts)
        }
      })
    }

    const updateMemory = () => {
      const perfMemory = (performance as any).memory
      if (perfMemory) {
        setMemory({
          used: perfMemory.usedJSHeapSize,
          total: perfMemory.totalJSHeapSize,
          limit: perfMemory.jsHeapSizeLimit
        })
      }
    }

    updateAnalysis()
    updateScripts()
    updateMemory()

    const interval = setInterval(() => {
      if (isMonitoring) {
        updateAnalysis()
        updateScripts()
        updateMemory()
      }
    }, 1000)

    port.onMessage.addListener((message) => {
      if (message.type === "ANALYSIS_UPDATE") {
        setAnalysis(message.data)
      } else if (message.type === "SCRIPT_UPDATE") {
        setScripts(message.scripts || [])
      }
    })

    return () => {
      clearInterval(interval)
      port.disconnect()
    }
  }, [isMonitoring])

  return (
    <div className="p-4 bg-[#2d2d2d] text-[#e8e8e8] min-h-screen">
      <div className="flex items-center justify-between mb-5 border-b border-[#404040] pb-2">
        <h1 className="text-lg font-semibold text-[#e8e8e8]">Tide DevTools</h1>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`px-3 py-1 text-xs rounded border ${
            isMonitoring
              ? "bg-[#1e3a2e] border-[#4a7c5a] text-[#7db892]"
              : "bg-[#363636] border-[#404040] text-[#b0b0b0]"
          }`}
        >
          {isMonitoring ? "Monitoring" : "Paused"}
        </button>
      </div>

      {analysis && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-xs text-[#808080] mb-1 uppercase">Total Size</div>
            <div className="text-lg font-mono font-semibold text-[#e8e8e8]">
              {formatBytes(analysis.totalSize)}
            </div>
          </div>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-xs text-[#808080] mb-1 uppercase">Scripts</div>
            <div className="text-lg font-mono font-semibold text-[#e8e8e8]">
              {analysis.scripts.length}
            </div>
          </div>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-xs text-[#808080] mb-1 uppercase">Third-Party</div>
            <div className="text-lg font-mono font-semibold text-[#d4a574]">
              {formatBytes(analysis.thirdPartySize)}
            </div>
          </div>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="text-xs text-[#808080] mb-1 uppercase">Long Tasks</div>
            <div className="text-lg font-mono font-semibold text-[#e8e8e8]">
              {analysis.performance.longTasks}
            </div>
          </div>
        </div>
      )}

      {memory && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-[#b0b0b0] mb-2 uppercase">Memory Usage</h2>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[#808080] mb-1">Used</div>
                <div className="font-mono text-[#e8e8e8]">{formatBytes(memory.used)}</div>
              </div>
              <div>
                <div className="text-[#808080] mb-1">Total</div>
                <div className="font-mono text-[#e8e8e8]">{formatBytes(memory.total)}</div>
              </div>
              <div>
                <div className="text-[#808080] mb-1">Limit</div>
                <div className="font-mono text-[#e8e8e8]">{formatBytes(memory.limit)}</div>
              </div>
            </div>
            <div className="mt-2 h-2 bg-[#404040] rounded overflow-hidden">
              <div
                className="h-full bg-[#7db3d3]"
                style={{ width: `${(memory.used / memory.limit) * 100}%` }}
              />
            </div>
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2 className="text-sm font-semibold text-[#b0b0b0] mb-2 uppercase">Script Monitoring</h2>
        <div className="p-3 bg-[#363636] border border-[#404040] rounded max-h-64 overflow-y-auto">
          {scripts.length > 0 ? (
            <div className="space-y-2">
              {scripts.map((script, i) => (
                <div key={i} className="text-xs p-2 bg-[#2d2d2d] rounded border border-[#404040]">
                  <div className="font-medium text-[#e8e8e8]">{script.src || "Inline"}</div>
                  <div className="text-[#808080] mt-1">
                    {script.action} at {new Date(script.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#808080]">No script changes detected</div>
          )}
        </div>
      </section>

      {analysis && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-[#b0b0b0] mb-2 uppercase">Network Timing</h2>
          <div className="p-3 bg-[#363636] border border-[#404040] rounded">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#808080]">Load Time</span>
                <span className="font-mono text-[#e8e8e8]">
                  {formatTime(analysis.performance.scriptLoadTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Parse Time</span>
                <span className="font-mono text-[#e8e8e8]">
                  {formatTime(analysis.performance.scriptParseTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Time to Interactive</span>
                <span className="font-mono text-[#e8e8e8]">
                  {formatTime(analysis.performance.timeToInteractive)}
                </span>
              </div>
              {analysis.performance.mainThreadBlockingTime > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#808080]">Main Thread Blocking</span>
                  <span className="font-mono text-[#d4a574]">
                    {formatTime(analysis.performance.mainThreadBlockingTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

