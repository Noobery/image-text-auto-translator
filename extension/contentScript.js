/**
 * Image Translator - Content Script (Main Entry Point)
 * 
 * This script initializes the UI and coordinates the extension.
 * Functionality is split across multiple files:
 * - utils.js: Shared utilities (capture, translate, helpers)
 * - ocr.js: Tesseract OCR wrapper and language detection
 * - selection.js: Click & drag selection mode
 * - scanner.js: Auto-scan images on page
 * 
 * @version 12 - Modular structure
 */

console.log("🔵 Image Translator v12 - Modular structure");

// ============================================
// GLOBAL STATE
// ============================================

let selectionMode = false;
let ocrLanguage = "auto"; // "auto", "chi_sim", "chi_tra", "jpn", "jpn_vert", "kor", "eng"

// Status panel state
let statusPanel = null;
let statusStartTime = null;
let statusTimer = null;

// ============================================
// INITIALIZATION
// ============================================

function init() {
  injectStyles();
  createToolbar();
  initSelectionEventListeners();
  console.log("✅ Image Translator initialized. Use toolbar to select regions or scan images.");
}

function injectStyles() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("contentStyles.css");
  document.head.appendChild(link);
}

// ============================================
// TOOLBAR UI
// ============================================

function createToolbar() {
  const toolbar = document.createElement("div");
  toolbar.className = "it-toolbar";
  toolbar.id = "image-translator-toolbar";
  toolbar.innerHTML = `
    <span class="it-label">🌐 Translator</span>
    <select id="it-lang-select" title="OCR Language">
      <option value="auto">🔄 Auto-detect</option>
      <option value="chi_sim">🇨🇳 Chinese (Simplified)</option>
      <option value="chi_tra">🇹🇼 Chinese (Traditional)</option>
      <option value="jpn">🇯🇵 Japanese (Horizontal)</option>
      <option value="jpn_vert">🇯🇵 Japanese (Vertical)</option>
      <option value="kor">🇰🇷 Korean</option>
      <option value="eng">🇬🇧 English</option>
    </select>
    <button id="it-select-btn">📋 Select</button>
    <button id="it-auto-btn">🔄 Scan</button>
  `;
  document.body.appendChild(toolbar);

  // Event listeners
  document.getElementById("it-select-btn").addEventListener("click", toggleSelectionMode);
  document.getElementById("it-auto-btn").addEventListener("click", handleScanClick);
  document.getElementById("it-lang-select").addEventListener("change", handleLanguageChange);
}

function handleScanClick() {
  scanImages();
  updateStatus("Scanning images...", 0);
}

function handleLanguageChange(e) {
  ocrLanguage = e.target.value;
  const langName = e.target.options[e.target.selectedIndex].text;
  console.log("OCR language set to:", ocrLanguage);
  updateStatus(`Language: ${langName}`, 0);
}

function toggleSelectionMode() {
  selectionMode = !selectionMode;
  const btn = document.getElementById("it-select-btn");

  if (selectionMode) {
    btn.classList.add("active");
    btn.textContent = "✓ Selection Active";
    document.body.classList.add("it-selection-mode");
    updateStatus("Click and drag to select text area", 0, "Selection mode active");
  } else {
    btn.classList.remove("active");
    btn.textContent = "📋 Select";
    document.body.classList.remove("it-selection-mode");
    hideStatus();
  }
}

// ============================================
// STATUS PANEL UI
// ============================================

function createStatusPanel() {
  if (statusPanel) return statusPanel;

  statusPanel = document.createElement("div");
  statusPanel.id = "image-translator-status";
  statusPanel.innerHTML = `
    <div class="it-header">
      <span class="it-icon">🌐</span>
      <span class="it-title">Image Translator</span>
      <span class="it-timer">0:00</span>
    </div>
    <div class="it-status">Initializing...</div>
    <div class="it-progress-bar"><div class="it-progress-fill"></div></div>
    <div class="it-details"></div>
  `;

  document.body.appendChild(statusPanel);
  return statusPanel;
}

function updateStatus(status, progress = null, details = null) {
  const panel = createStatusPanel();
  panel.classList.remove("it-hidden", "it-success", "it-error");

  panel.querySelector(".it-status").textContent = status;

  if (progress !== null) {
    panel.querySelector(".it-progress-fill").style.width = `${progress}%`;
  }

  if (details) {
    panel.querySelector(".it-details").textContent = details;
  }

  // Start timer if not started
  if (!statusStartTime) {
    statusStartTime = Date.now();
    statusTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - statusStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      panel.querySelector(".it-timer").textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    }, 1000);
  }
}

function showSuccess(message) {
  const panel = createStatusPanel();
  panel.classList.add("it-success");
  panel.querySelector(".it-status").textContent = message;
  panel.querySelector(".it-progress-fill").style.width = "100%";

  clearStatusTimer();
  setTimeout(() => hideStatus(), 5000);
}

function showError(message) {
  const panel = createStatusPanel();
  panel.classList.add("it-error");
  panel.querySelector(".it-status").textContent = "Error: " + message;

  clearStatusTimer();
  setTimeout(() => hideStatus(), 8000);
}

function hideStatus() {
  if (statusPanel) {
    statusPanel.classList.add("it-hidden");
  }
  clearStatusTimer();
}

function clearStatusTimer() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
  }
  statusStartTime = null;
}

// ============================================
// START
// ============================================

init();
