import { useState, useEffect } from "react"
import "./popup.css"

interface Settings {
  trackFrameworks: boolean
  trackLibraries: boolean
  trackPerformance: boolean
  trackSecurity: boolean
  alertThreshold: number
  whitelistDomains: string[]
  blacklistDomains: string[]
  customFrameworks: Array<{ name: string; detector: string }>
  customLibraries: Array<{ name: string; detector: string }>
  apiEnabled: boolean
  apiEndpoint: string
}

const defaultSettings: Settings = {
  trackFrameworks: true,
  trackLibraries: true,
  trackPerformance: true,
  trackSecurity: true,
  alertThreshold: 2 * 1024 * 1024,
  whitelistDomains: [],
  blacklistDomains: [],
  customFrameworks: [],
  customLibraries: [],
  apiEnabled: false,
  apiEndpoint: ""
}

export default function OptionsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [saved, setSaved] = useState(false)
  const [newWhitelist, setNewWhitelist] = useState("")
  const [newBlacklist, setNewBlacklist] = useState("")
  const [newFramework, setNewFramework] = useState({ name: "", detector: "" })
  const [newLibrary, setNewLibrary] = useState({ name: "", detector: "" })

  useEffect(() => {
    chrome.storage.sync.get(["tideSettings"], (result) => {
      if (result.tideSettings) {
        setSettings({ ...defaultSettings, ...result.tideSettings })
      }
    })
  }, [])

  const saveSettings = () => {
    chrome.storage.sync.set({ tideSettings: settings }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const addWhitelist = () => {
    if (newWhitelist.trim()) {
      setSettings({
        ...settings,
        whitelistDomains: [...settings.whitelistDomains, newWhitelist.trim()]
      })
      setNewWhitelist("")
    }
  }

  const removeWhitelist = (domain: string) => {
    setSettings({
      ...settings,
      whitelistDomains: settings.whitelistDomains.filter((d) => d !== domain)
    })
  }

  const addBlacklist = () => {
    if (newBlacklist.trim()) {
      setSettings({
        ...settings,
        blacklistDomains: [...settings.blacklistDomains, newBlacklist.trim()]
      })
      setNewBlacklist("")
    }
  }

  const removeBlacklist = (domain: string) => {
    setSettings({
      ...settings,
      blacklistDomains: settings.blacklistDomains.filter((d) => d !== domain)
    })
  }

  const addCustomFramework = () => {
    if (newFramework.name.trim() && newFramework.detector.trim()) {
      setSettings({
        ...settings,
        customFrameworks: [...settings.customFrameworks, { ...newFramework }]
      })
      setNewFramework({ name: "", detector: "" })
    }
  }

  const removeCustomFramework = (index: number) => {
    setSettings({
      ...settings,
      customFrameworks: settings.customFrameworks.filter((_, i) => i !== index)
    })
  }

  const addCustomLibrary = () => {
    if (newLibrary.name.trim() && newLibrary.detector.trim()) {
      setSettings({
        ...settings,
        customLibraries: [...settings.customLibraries, { ...newLibrary }]
      })
      setNewLibrary({ name: "", detector: "" })
    }
  }

  const removeCustomLibrary = (index: number) => {
    setSettings({
      ...settings,
      customLibraries: settings.customLibraries.filter((_, i) => i !== index)
    })
  }

  return (
    <div className="p-6 bg-[#2d2d2d] text-[#e8e8e8] min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 border-b border-[#404040] pb-4">
          <h1 className="text-2xl font-semibold text-[#e8e8e8]">Tide Settings</h1>
          <button
            onClick={saveSettings}
            className="px-4 py-2 bg-[#1e3a5f] border border-[#4a7ba7] rounded text-[#7db3d3] hover:bg-[#2d4a6f] transition-colors"
          >
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">Tracking Options</h2>
          <div className="space-y-3 p-4 bg-[#363636] border border-[#404040] rounded">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.trackFrameworks}
                onChange={(e) =>
                  setSettings({ ...settings, trackFrameworks: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-[#e8e8e8]">Track Frameworks</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.trackLibraries}
                onChange={(e) =>
                  setSettings({ ...settings, trackLibraries: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-[#e8e8e8]">Track Libraries</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.trackPerformance}
                onChange={(e) =>
                  setSettings({ ...settings, trackPerformance: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-[#e8e8e8]">Track Performance Metrics</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.trackSecurity}
                onChange={(e) =>
                  setSettings({ ...settings, trackSecurity: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-[#e8e8e8]">Track Security Issues</span>
            </label>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">Alert Threshold</h2>
          <div className="p-4 bg-[#363636] border border-[#404040] rounded">
            <label className="block text-sm text-[#e8e8e8] mb-2">
              Warn if total JS size exceeds (MB):
            </label>
            <input
              type="number"
              value={settings.alertThreshold / (1024 * 1024)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alertThreshold: parseFloat(e.target.value) * 1024 * 1024
                })
              }
              className="w-32 px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8] font-mono"
              min="0"
              step="0.1"
            />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">Domain Whitelist</h2>
          <div className="p-4 bg-[#363636] border border-[#404040] rounded">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newWhitelist}
                onChange={(e) => setNewWhitelist(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8]"
                onKeyPress={(e) => e.key === "Enter" && addWhitelist()}
              />
              <button
                onClick={addWhitelist}
                className="px-4 py-2 bg-[#1e3a2e] border border-[#4a7c5a] rounded text-[#7db892] hover:bg-[#2d4a3e] transition-colors"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {settings.whitelistDomains.map((domain, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-[#2d2d2d] rounded border border-[#404040]"
                >
                  <span className="text-sm text-[#e8e8e8] font-mono">{domain}</span>
                  <button
                    onClick={() => removeWhitelist(domain)}
                    className="text-xs text-[#d4a5a5] hover:text-[#e8e8e8]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">Domain Blacklist</h2>
          <div className="p-4 bg-[#363636] border border-[#404040] rounded">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newBlacklist}
                onChange={(e) => setNewBlacklist(e.target.value)}
                placeholder="example.com"
                className="flex-1 px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8]"
                onKeyPress={(e) => e.key === "Enter" && addBlacklist()}
              />
              <button
                onClick={addBlacklist}
                className="px-4 py-2 bg-[#3a2d1a] border border-[#8b6914] rounded text-[#d4a574] hover:bg-[#4a3d2a] transition-colors"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {settings.blacklistDomains.map((domain, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-[#2d2d2d] rounded border border-[#404040]"
                >
                  <span className="text-sm text-[#e8e8e8] font-mono">{domain}</span>
                  <button
                    onClick={() => removeBlacklist(domain)}
                    className="text-xs text-[#d4a5a5] hover:text-[#e8e8e8]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">Custom Frameworks</h2>
          <div className="p-4 bg-[#363636] border border-[#404040] rounded">
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={newFramework.name}
                onChange={(e) => setNewFramework({ ...newFramework, name: e.target.value })}
                placeholder="Framework name"
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8]"
              />
              <input
                type="text"
                value={newFramework.detector}
                onChange={(e) => setNewFramework({ ...newFramework, detector: e.target.value })}
                placeholder="window.myFramework or document.querySelector(...)"
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8] font-mono text-sm"
              />
              <button
                onClick={addCustomFramework}
                className="w-full px-4 py-2 bg-[#1e3a5f] border border-[#4a7ba7] rounded text-[#7db3d3] hover:bg-[#2d4a6f] transition-colors"
              >
                Add Framework
              </button>
            </div>
            <div className="space-y-2">
              {settings.customFrameworks.map((fw, i) => (
                <div
                  key={i}
                  className="p-2 bg-[#2d2d2d] rounded border border-[#404040]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#e8e8e8]">{fw.name}</span>
                    <button
                      onClick={() => removeCustomFramework(i)}
                      className="text-xs text-[#d4a5a5] hover:text-[#e8e8e8]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-xs text-[#808080] font-mono">{fw.detector}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">Custom Libraries</h2>
          <div className="p-4 bg-[#363636] border border-[#404040] rounded">
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={newLibrary.name}
                onChange={(e) => setNewLibrary({ ...newLibrary, name: e.target.value })}
                placeholder="Library name"
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8]"
              />
              <input
                type="text"
                value={newLibrary.detector}
                onChange={(e) => setNewLibrary({ ...newLibrary, detector: e.target.value })}
                placeholder="window.myLibrary or document.querySelector(...)"
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8] font-mono text-sm"
              />
              <button
                onClick={addCustomLibrary}
                className="w-full px-4 py-2 bg-[#1e3a2e] border border-[#4a7c5a] rounded text-[#7db892] hover:bg-[#2d4a3e] transition-colors"
              >
                Add Library
              </button>
            </div>
            <div className="space-y-2">
              {settings.customLibraries.map((lib, i) => (
                <div
                  key={i}
                  className="p-2 bg-[#2d2d2d] rounded border border-[#404040]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#e8e8e8]">{lib.name}</span>
                    <button
                      onClick={() => removeCustomLibrary(i)}
                      className="text-xs text-[#d4a5a5] hover:text-[#e8e8e8]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-xs text-[#808080] font-mono">{lib.detector}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-[#b0b0b0] mb-4 uppercase">API Integration</h2>
          <div className="p-4 bg-[#363636] border border-[#404040] rounded">
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={settings.apiEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, apiEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-[#e8e8e8]">Enable API Integration (Opt-in)</span>
            </label>
            {settings.apiEnabled && (
              <div className="space-y-2">
                <label className="block text-sm text-[#e8e8e8]">
                  API Endpoint:
                </label>
                <input
                  type="text"
                  value={settings.apiEndpoint}
                  onChange={(e) =>
                    setSettings({ ...settings, apiEndpoint: e.target.value })
                  }
                  placeholder="https://api.example.com/tide"
                  className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded text-[#e8e8e8] font-mono text-sm"
                />
                <p className="text-xs text-[#808080]">
                  Data sent is anonymized. Only includes aggregate metrics, no personal information.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

