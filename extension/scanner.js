/**
 * Image Translator - Scanner
 * Auto-scan images on page, detect text blocks, and translate them
 */

const PROCESSED_ATTR = "data-ocr-processed";

// ============================================
// SCANNER
// ============================================

/**
 * Scan all images on the page
 */
function scanImages() {
  const imgs = Array.from(document.images);
  const processableImages = imgs.filter((img) => img.width >= 80 && img.height >= 40);

  console.log(`Found ${imgs.length} images, ${processableImages.length} large enough to process`);

  if (processableImages.length === 0) {
    console.log("No suitable images found");
    showError("No suitable images found on this page");
    return;
  }

  updateStatus(`Found ${processableImages.length} image(s) to process`, 0, "Starting...");

  for (const img of processableImages) {
    if (!img.complete) {
      img.addEventListener("load", () => processImage(img), { once: true });
    } else {
      processImage(img);
    }
  }
}

// ============================================
// IMAGE PROCESSING
// ============================================

/**
 * Process a single image - detect text blocks and translate each
 */
async function processImage(img) {
  if (img.hasAttribute(PROCESSED_ATTR)) return;
  img.setAttribute(PROCESSED_ATTR, "true");

  try {
    console.log("Processing image:", img.src.substring(0, 80));
    updateStatus("Capturing image...", 5, img.src.substring(0, 50) + "...");

    const imageDataUrl = await getImageAsDataUrl(img);
    console.log("Got image as data URL, length:", imageDataUrl.length);

    // Step 1: Auto-detect language if needed
    let detectedLang = ocrLanguage;
    if (ocrLanguage === "auto") {
      updateStatus("Detecting language...", 10);
      detectedLang = await detectTextLanguage(imageDataUrl);

      // Check for vertical text
      const isVertical = isLikelyVerticalText(img.naturalWidth || img.width, img.naturalHeight || img.height);
      if (detectedLang === "jpn" && isVertical) {
        detectedLang = "jpn_vert";
      }
    }

    // Step 2: Full OCR with detected language
    updateStatus(`Running OCR (${detectedLang})...`, 20);
    const ocrData = await runOcrWithLanguage(imageDataUrl, detectedLang);

    console.log("OCR Result:", {
      text: ocrData.text,
      blocks: ocrData.blocks?.length || 0,
      paragraphs: ocrData.paragraphs?.length || 0,
      lines: ocrData.lines?.length || 0,
      confidence: ocrData.confidence
    });

    // Step 3: Get text blocks (paragraphs are better semantic units than lines)
    const blocks = ocrData.paragraphs && ocrData.paragraphs.length > 0
      ? ocrData.paragraphs
      : ocrData.lines || [];

    if (blocks.length === 0) {
      console.log("No text blocks detected");
      showError("No text detected in image");
      return;
    }

    // Filter blocks with actual text
    const validBlocks = blocks.filter(b => b.text && b.text.trim().length >= 2);

    if (validBlocks.length === 0) {
      showError("No readable text found");
      return;
    }

    console.log(`Found ${validBlocks.length} text blocks to translate`);
    updateStatus(`Translating ${validBlocks.length} text blocks...`, 50);

    // Step 4: Translate each block
    const translations = [];
    for (let i = 0; i < validBlocks.length; i++) {
      const block = validBlocks[i];
      updateStatus(`Translating block ${i + 1}/${validBlocks.length}...`, 50 + (i / validBlocks.length) * 40);

      try {
        const translated = await translateTextAsync(block.text.trim());
        translations.push(translated);
      } catch (e) {
        console.error(`Failed to translate block ${i}:`, e);
        translations.push(block.text); // Fallback to original
      }
    }

    // Step 5: Overlay translations
    overlayTextBlocks(img, validBlocks, translations);
    showSuccess(`Translated ${validBlocks.length} text blocks!`);

  } catch (e) {
    console.error("OCR failed for image:", img.src, e);
    showError(e.message || "OCR failed");
  }
}

// ============================================
// BLOCK OVERLAYS
// ============================================

/**
 * Overlay text blocks with transparent background
 */
function overlayTextBlocks(img, blocks, translations) {
  console.log("📍 overlayTextBlocks called with", blocks.length, "blocks");

  const imgRect = img.getBoundingClientRect();
  const imageWidth = img.naturalWidth || imgRect.width;
  const imageHeight = img.naturalHeight || imgRect.height;

  // Scale factors
  const scaleX = imgRect.width / imageWidth;
  const scaleY = imgRect.height / imageHeight;

  blocks.forEach((block, i) => {
    const translated = translations[i];
    if (!translated || !translated.trim()) return;

    const bbox = block.bbox;

    // Calculate position and size
    const left = imgRect.left + window.scrollX + (bbox.x0 * scaleX);
    const top = imgRect.top + window.scrollY + (bbox.y0 * scaleY);
    const width = (bbox.x1 - bbox.x0) * scaleX;
    const height = (bbox.y1 - bbox.y0) * scaleY;

    // Calculate font size based on block size
    const fontSize = calculateFontSize(width, height, translated.length, 10, 24);

    const overlay = document.createElement("div");
    overlay.className = "it-block-overlay";
    overlay.style.cssText = `
      position: absolute;
      left: ${left}px;
      top: ${top}px;
      width: ${width}px;
      height: ${height}px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2px;
      box-sizing: border-box;
      z-index: 2147483646;
      pointer-events: auto;
      cursor: pointer;
      background: transparent;
    `;

    overlay.innerHTML = `
      <span style="
        color: #fff;
        font-size: ${fontSize}px;
        line-height: 1.2;
        font-family: 'Segoe UI', Arial, sans-serif;
        font-weight: 600;
        word-wrap: break-word;
        overflow-wrap: break-word;
        text-shadow: 
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000,
          0 0 4px #000;
      ">${translated}</span>
    `;

    // Click to dismiss this overlay
    overlay.addEventListener("click", () => overlay.remove());

    document.body.appendChild(overlay);
  });

  console.log("✅ Block overlays added");
}

/**
 * Legacy overlay for line-by-line translations
 */
function overlayTranslations(img, ocrData, translatedText) {
  console.log("📍 overlayTranslations called");

  const translatedLines = translatedText.split("\n");
  const imgRect = img.getBoundingClientRect();

  const wrapper = document.createElement("div");
  wrapper.className = "image-translator-overlay";
  wrapper.style.cssText = `
    position: absolute;
    left: ${imgRect.left + window.scrollX}px;
    top: ${imgRect.top + window.scrollY}px;
    width: ${imgRect.width}px;
    height: ${imgRect.height}px;
    pointer-events: none;
    z-index: 2147483646;
  `;

  const imageWidth = ocrData.imageSize?.width || img.naturalWidth || imgRect.width;
  const imageHeight = ocrData.imageSize?.height || img.naturalHeight || imgRect.height;

  ocrData.lines.forEach((line, i) => {
    const bbox = line.bbox;
    const translated = translatedLines[i] || line.text;

    if (!translated.trim()) return;

    const div = document.createElement("div");
    div.textContent = translated;
    div.style.cssText = `
      position: absolute;
      left: ${(bbox.x0 / imageWidth) * 100}%;
      top: ${(bbox.y0 / imageHeight) * 100}%;
      font-size: 14px;
      font-family: Arial, sans-serif;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      padding: 2px 6px;
      border-radius: 3px;
      max-width: 90%;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    wrapper.appendChild(div);
  });

  document.body.appendChild(wrapper);
  console.log("✅ Overlay added with", wrapper.children.length, "lines");
}

/**
 * Simple overlay below image
 */
function overlaySimpleTranslation(img, originalText, translatedText) {
  const imgRect = img.getBoundingClientRect();

  const panel = document.createElement("div");
  panel.className = "image-translator-simple-overlay";
  panel.style.cssText = `
    position: absolute;
    left: ${imgRect.left + window.scrollX}px;
    top: ${imgRect.bottom + window.scrollY + 10}px;
    max-width: ${Math.max(imgRect.width, 300)}px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid #4ecca3;
    border-radius: 8px;
    padding: 12px;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    color: #fff;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  `;

  panel.innerHTML = `
    <div style="color: #4ecca3; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center;">
      <span style="margin-right: 8px;">🌐</span> Translation
    </div>
    <div style="color: #e0e0e0; line-height: 1.5; white-space: pre-wrap;">${translatedText}</div>
    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
      <details style="color: #888; font-size: 12px;">
        <summary style="cursor: pointer; color: #666;">Original text</summary>
        <div style="margin-top: 8px; white-space: pre-wrap; color: #999;">${originalText}</div>
      </details>
    </div>
  `;

  document.body.appendChild(panel);
  console.log("✅ Simple overlay added");
}

console.log("✅ scanner.js loaded");
