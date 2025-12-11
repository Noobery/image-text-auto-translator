// offscreen.js - Handles image fetching in an offscreen document
// Offscreen documents can make fetch requests without CORS issues

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OFFSCREEN_FETCH_IMAGE") {
    console.log("Offscreen: Fetching image:", msg.url);
    
    fetchImageAsDataUrl(msg.url)
      .then((dataUrl) => {
        console.log("Offscreen: Got dataUrl, length:", dataUrl.length);
        sendResponse({ dataUrl });
      })
      .catch((err) => {
        console.error("Offscreen: Fetch failed:", err);
        sendResponse({ error: true, message: err.message });
      });
    
    return true;
  }
});

async function fetchImageAsDataUrl(url) {
  // Use XMLHttpRequest which has different CORS behavior
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "blob";
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    
    xhr.onerror = function() {
      reject(new Error("XHR request failed"));
    };
    
    xhr.send();
  });
}
