import type { AnalysisData } from "./types"

export interface PeerComparison {
  domain: string
  totalSize: number
  scriptCount: number
  thirdPartySize: number
  frameworks: string[]
}

export interface CommunityData {
  averageSize: number
  averageScriptCount: number
  commonFrameworks: Array<{ name: string; percentage: number }>
  commonLibraries: Array<{ name: string; percentage: number }>
}

export async function sendAnalysisToAPI(
  analysis: AnalysisData,
  apiEndpoint: string
): Promise<boolean> {
  try {
    const payload = {
      totalSize: analysis.totalSize,
      scriptCount: analysis.scripts.length,
      thirdPartySize: analysis.thirdPartySize,
      frameworks: analysis.frameworks.map((f) => f.name),
      libraries: analysis.libraries.map((l) => l.name),
      timestamp: analysis.timestamp
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    return response.ok
  } catch (error) {
    console.error("Failed to send analysis to API:", error)
    return false
  }
}

export async function getPeerComparisons(
  domain: string,
  apiEndpoint: string
): Promise<PeerComparison[]> {
  try {
    const response = await fetch(
      `${apiEndpoint}/peers?domain=${encodeURIComponent(domain)}`
    )
    if (response.ok) {
      const data = await response.json()
      return data.peers || []
    }
  } catch (error) {
    console.error("Failed to get peer comparisons:", error)
  }
  return []
}

export async function getCommunityData(
  apiEndpoint: string
): Promise<CommunityData | null> {
  try {
    const response = await fetch(`${apiEndpoint}/community`)
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.error("Failed to get community data:", error)
  }
  return null
}

export async function getRecommendations(
  analysis: AnalysisData,
  domain: string,
  apiEndpoint: string
): Promise<string[]> {
  try {
    const payload = {
      totalSize: analysis.totalSize,
      scriptCount: analysis.scripts.length,
      thirdPartySize: analysis.thirdPartySize,
      frameworks: analysis.frameworks.map((f) => f.name),
      libraries: analysis.libraries.map((l) => l.name)
    }

    const response = await fetch(
      `${apiEndpoint}/recommendations?domain=${encodeURIComponent(domain)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    )

    if (response.ok) {
      const data = await response.json()
      return data.recommendations || []
    }
  } catch (error) {
    console.error("Failed to get recommendations:", error)
  }
  return []
}

