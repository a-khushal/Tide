if (typeof chrome !== "undefined" && chrome.devtools) {
  chrome.devtools.panels.create(
    "Tide",
    chrome.runtime.getURL("icon16.plasmo.9f44d99c.png"),
    chrome.runtime.getURL("devtools.html"),
    (panel) => {
      console.log("Tide DevTools panel created")
    }
  )
}

