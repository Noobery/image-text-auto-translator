/**
 * Image Translator - Selection Mode
 * Click and drag to select text regions for translation
 */

// ============================================
// SELECTION STATE
// ============================================

let selectionBox = null;
let startX = 0;
let startY = 0;
let isSelecting = false;

// ============================================
// EVENT HANDLERS
// ============================================

function initSelectionEventListeners() {
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}

function handleMouseDown(e) {
  if (!selectionMode) return;
  if (isUIElement(e.target)) return;

  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;

  selectionBox = document.createElement("div");
  selectionBox.className = "it-selection-box";
  selectionBox.style.left = startX + "px";
  selectionBox.style.top = startY + "px";
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
  document.body.appendChild(selectionBox);

  e.preventDefault();
  e.stopPropagation();
}

function handleMouseMove(e) {
  if (!isSelecting || !selectionBox) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  selectionBox.style.left = left + "px";
  selectionBox.style.top = top + "px";
  selectionBox.style.width = width + "px";
  selectionBox.style.height = height + "px";
}

function handleMouseUp(e) {
  if (!isSelecting || !selectionBox) return;

  isSelecting = false;

  const rect = selectionBox.getBoundingClientRect();
  selectionBox.remove();
  selectionBox = null;

  // Minimum selection size
  if (rect.width < 20 || rect.height < 20) {
    console.log("Selection too small, ignoring");
    return;
  }

  // Prevent click event from triggering page navigation
  e.preventDefault();
  e.stopPropagation();
  blockNextClick();

  console.log("Selection made:", rect);
  processSelectedRegion(rect);
}

function blockNextClick() {
  const blockClick = (clickEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    clickEvent.stopImmediatePropagation();
    document.removeEventListener("click", blockClick, true);
  };
  document.addEventListener("click", blockClick, true);
  setTimeout(() => document.removeEventListener("click", blockClick, true), 100);
}

// ============================================
// SELECTION PROCESSING
// ============================================

async function processSelectedRegion(rect) {
  updateStatus("Capturing selected area...", 10);

  try {
    const dataUrl = await captureRegionViaBackground(rect);
    console.log("Captured region, dataUrl length:", dataUrl.length);

    const ocrData = await ocrImage(dataUrl, rect.width, rect.height);

    let text = extractTextFromOcrData(ocrData);

    if (!text || text.length < 2) {
      showError("No text detected in selection");
      return;
    }

    console.log("Detected text:", text);
    updateStatus("Translating...", 80);

    translateText(text, (translated) => {
      showSelectionOverlay(rect, text, translated);
      showSuccess("Translation complete!");
    }, (error) => {
      showError(error);
    });
  } catch (e) {
    console.error("Selection processing failed:", e);
    showError(e.message);
  }
}

// ============================================
// SELECTION OVERLAY
// ============================================

function showSelectionOverlay(rect, originalText, translatedText) {
  // Remove existing popups
  document.querySelectorAll(".it-translation-popup").forEach((el) => el.remove());

  const popup = document.createElement("div");
  popup.className = "it-translation-popup it-overlay-mode";

  // Position directly on top of the selection
  popup.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    min-width: unset;
    max-width: unset;
    max-height: unset;
    padding: 4px;
    margin: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: transparent;
    border: none;
    box-sizing: border-box;
    pointer-events: auto;
    z-index: 2147483647;
  `;

  // Calculate font size
  const fontSize = calculateFontSize(rect.width, rect.height, translatedText.length, 12, 32);

  popup.innerHTML = `
    <div class="it-overlay-text" style="
      color: #fff;
      font-size: ${fontSize}px;
      line-height: 1.3;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-weight: 600;
      word-wrap: break-word;
      overflow-wrap: break-word;
      text-shadow: 
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 0 3px #000,
        0 0 6px #000;
    ">${translatedText.replace(/\n/g, "<br>")}</div>
  `;

  // Click to dismiss
  popup.addEventListener("click", () => popup.remove());

  document.body.appendChild(popup);
}

console.log("✅ selection.js loaded");
