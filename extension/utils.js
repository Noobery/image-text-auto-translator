/**
 * Image Translator - Utility Functions
 * Shared utilities for capture, translation, and helpers
 */

// ============================================
// IMAGE CAPTURE
// ============================================

/**
 * Capture image via screenshot from background script
 */
function captureImageViaScreenshot(img) {
  return new Promise((resolve, reject) => {
    const rect = img.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      reject(new Error("Image not visible"));
      return;
    }

    console.log("Requesting screenshot capture for rect:", rect);

    chrome.runtime.sendMessage(
      {
        type: "CAPTURE_IMAGE_REGION",
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        devicePixelRatio: window.devicePixelRatio || 1
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || response.error) {
          reject(new Error(response?.message || "Capture failed"));
          return;
        }
        resolve(response.dataUrl);
      }
    );
  });
}

/**
 * Capture a region via background script
 */
function captureRegionViaBackground(rect) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "CAPTURE_IMAGE_REGION",
        rect: {
          x: rect.x || rect.left,
          y: rect.y || rect.top,
          width: rect.width,
          height: rect.height
        },
        devicePixelRatio: window.devicePixelRatio || 1
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.dataUrl) {
          resolve(response.dataUrl);
        } else {
          reject(new Error(response?.message || "Capture failed"));
        }
      }
    );
  });
}

/**
 * Try to capture image using canvas (same-origin only)
 */
function tryCanvasCapture(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Get image as data URL - tries canvas first, then screenshot
 */
async function getImageAsDataUrl(img) {
  if (img.src.startsWith("data:")) {
    return img.src;
  }

  // Try canvas first (same-origin only)
  try {
    const dataUrl = tryCanvasCapture(img);
    console.log("✅ Canvas capture succeeded");
    return dataUrl;
  } catch (e) {
    console.log("❌ Canvas capture failed - cross-origin");
  }

  // Fallback to screenshot
  console.log("Trying screenshot capture...");
  const dataUrl = await captureImageViaScreenshot(img);
  console.log("✅ Screenshot capture succeeded");
  return dataUrl;
}

// ============================================
// TRANSLATION
// ============================================

/**
 * Translate text with callback
 */
function translateText(text, onSuccess, onError) {
  chrome.runtime.sendMessage(
    { type: "TRANSLATE_TEXT", text, targetLang: "en" },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Message error:", chrome.runtime.lastError);
        if (onError) onError(chrome.runtime.lastError.message);
        return;
      }
      if (!response) {
        if (onError) onError("No response from translation service");
        return;
      }
      if (response.error) {
        if (onError) onError("Translation failed - is the server running?");
        return;
      }
      console.log("✅ Translated:", response.translated);
      onSuccess(response.translated);
    }
  );
}

/**
 * Translate text (Promise-based)
 */
function translateTextAsync(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "TRANSLATE_TEXT", text, targetLang: "en" },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || response.error) {
          reject(new Error("Translation failed"));
          return;
        }
        resolve(response.translated);
      }
    );
  });
}

// ============================================
// HELPERS
// ============================================

/**
 * Extract text from OCR data
 */
function extractTextFromOcrData(ocrData) {
  if (ocrData.lines && ocrData.lines.length > 0) {
    return ocrData.lines.map((l) => l.text).join("\n").trim();
  } else if (ocrData.text && ocrData.text.trim()) {
    console.log("Using raw text instead of lines array");
    return ocrData.text.trim();
  }
  return "";
}

/**
 * Check if target is a UI element (toolbar, popup, status)
 */
function isUIElement(target) {
  return target.closest(".it-toolbar") ||
         target.closest(".it-translation-popup") ||
         target.closest("#image-translator-status") ||
         target.closest(".it-block-overlay");
}

/**
 * Calculate appropriate font size based on area and text length
 */
function calculateFontSize(width, height, textLength, minSize = 10, maxSize = 32) {
  const area = width * height;
  return Math.min(Math.max(minSize, Math.sqrt(area / textLength) * 0.8), maxSize);
}

console.log("✅ utils.js loaded");
