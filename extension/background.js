// background.js (service worker)

console.log("🟢 Background service worker started");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background received message:", msg.type);
  
  if (msg.type === "TRANSLATE_TEXT") {
    translateLocally(msg.text, msg.targetLang || "en")
      .then((translated) => {
        sendResponse({ translated });
      })
      .catch((err) => {
        console.error("Translation error in background:", err);
        sendResponse({ error: true });
      });
    return true;
  }

  // Capture a specific region of the visible tab
  if (msg.type === "CAPTURE_IMAGE_REGION") {
    console.log("Background: CAPTURE_IMAGE_REGION request");
    
    captureImageRegion(sender.tab.id, msg.rect, msg.devicePixelRatio)
      .then((dataUrl) => {
        console.log("Background: Captured region, dataUrl length:", dataUrl.length);
        sendResponse({ dataUrl });
      })
      .catch((err) => {
        console.error("Background: Capture failed:", err.message);
        sendResponse({ error: true, message: err.message });
      });
    return true;
  }
  
  return false;
});

/**
 * Capture the visible tab and crop to a specific region
 */
async function captureImageRegion(tabId, rect, devicePixelRatio = 1) {
  console.log("Background: Capturing tab", tabId, "rect:", rect);
  
  // Capture the visible area of the tab
  const screenshotUrl = await chrome.tabs.captureVisibleTab(null, {
    format: "png"
  });
  
  console.log("Background: Screenshot captured, length:", screenshotUrl.length);
  
  // Create an offscreen canvas to crop the image
  // We need to use createImageBitmap and OffscreenCanvas in service worker
  const response = await fetch(screenshotUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  
  // Account for device pixel ratio
  const dpr = devicePixelRatio || 1;
  const cropX = Math.round(rect.x * dpr);
  const cropY = Math.round(rect.y * dpr);
  const cropWidth = Math.round(rect.width * dpr);
  const cropHeight = Math.round(rect.height * dpr);
  
  console.log("Background: Cropping at", { cropX, cropY, cropWidth, cropHeight, dpr });
  
  // Create offscreen canvas and crop
  const canvas = new OffscreenCanvas(cropWidth, cropHeight);
  const ctx = canvas.getContext("2d");
  
  ctx.drawImage(
    imageBitmap,
    cropX, cropY, cropWidth, cropHeight,  // source
    0, 0, cropWidth, cropHeight            // destination
  );
  
  // Convert to blob then to data URL
  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  const dataUrl = await blobToDataUrl(croppedBlob);
  
  return dataUrl;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function translateLocally(text, targetLang) {
  const res = await fetch("http://localhost:3000/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      targetLang
    })
  });

  if (!res.ok) {
    throw new Error("Translation API error");
  }

  const data = await res.json();
  return data.translated;
}
