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

            chrome.tabs.sendMessage(tab.id!, { type: "REQUEST_ANALYSIS" }, (msgResponse) => {
              if (chrome.runtime.lastError) {
                setError("Content script not available. Please refresh the page and try again.")
                setLoading(false)
                return
              }

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

  const containerStyle = {
    padding: 16,
    width: "375px",
    height: "600px",
    overflowY: "auto" as const,
    boxSizing: "border-box" as const
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <h2 style={{ margin: "0 0 16px 0" }}>Analyzing page...</h2>
        <div>Collecting JavaScript metrics...</div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div style={containerStyle}>
        <h2 style={{ margin: "0 0 16px 0" }}>Tide</h2>
        <div style={{ color: "#d32f2f" }}>{error || "No data available"}</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Try refreshing the page and opening this popup again.
        </div>
      </div>
    )
  }

  const topScripts = [...analysis.scripts]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: "0 0 20px 0", fontSize: 20 }}>Tide</h2>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
          Size Tracking
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Total Size</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{formatBytes(analysis.totalSize)}</div>
          </div>
          <div style={{ padding: 12, background: "#f5f5f5", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Gzipped</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{formatBytes(analysis.totalGzippedSize)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          {analysis.scripts.length} script{analysis.scripts.length !== 1 ? "s" : ""} detected
        </div>
      </section>

      {analysis.frameworks.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
            Frameworks
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {analysis.frameworks.map((fw) => (
              <div
                key={fw.name}
                style={{
                  padding: "8px 12px",
                  background: "#e3f2fd",
                  borderRadius: 4,
                  fontSize: 14
                }}
              >
                <div style={{ fontWeight: 600 }}>{fw.name}</div>
                {fw.version && (
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    v{fw.version}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {analysis.libraries.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
            Top Libraries
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {analysis.libraries.map((lib) => (
              <div
                key={lib.name}
                style={{
                  padding: "8px 12px",
                  background: "#f3e5f5",
                  borderRadius: 4,
                  fontSize: 14
                }}
              >
                <div style={{ fontWeight: 600 }}>{lib.name}</div>
                {lib.version && (
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    v{lib.version}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
          Performance Metrics
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, background: "#fff3e0", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Long Tasks</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{analysis.performance.longTasks}</div>
          </div>
          <div style={{ padding: 12, background: "#fff3e0", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>TTI</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {formatTime(analysis.performance.timeToInteractive)}
            </div>
          </div>
          <div style={{ padding: 12, background: "#fff3e0", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Load Time</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {formatTime(analysis.performance.scriptLoadTime)}
            </div>
          </div>
          <div style={{ padding: 12, background: "#fff3e0", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Parse Time</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {formatTime(analysis.performance.scriptParseTime)}
            </div>
          </div>
        </div>
        {analysis.performance.mainThreadBlockingTime > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: "#ffebee", borderRadius: 4 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
              Main Thread Blocking
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#c62828" }}>
              {formatTime(analysis.performance.mainThreadBlockingTime)}
            </div>
          </div>
        )}
      </section>

      {topScripts.length > 0 && (
        <section>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
            Top Scripts by Size
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topScripts.map((script, idx) => {
              const percentage = analysis.totalSize > 0 ? (script.size / analysis.totalSize) * 100 : 0
              const fileName = script.src.split("/").pop() || script.src
              return (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    background: "#f5f5f5",
                    borderRadius: 4,
                    fontSize: 12
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4, wordBreak: "break-all" }}>
                    {fileName}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>{formatBytes(script.size)}</span>
                    <span style={{ color: "#666" }}>{percentage.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    Gzipped: {formatBytes(script.gzippedSize)}
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
