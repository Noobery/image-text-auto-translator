/**
 * Image Translator - OCR Engine
 * Tesseract.js wrapper and language detection
 */

// ============================================
// LANGUAGE DETECTION
// ============================================

/**
 * Check if dimensions suggest vertical text
 */
function isLikelyVerticalText(width, height) {
  return height > width * 1.2;
}

/**
 * Detect language from text content by analyzing character ranges
 */
function detectLanguageFromText(text) {
  const chineseRegex = /[\u4e00-\u9fff]/g;
  const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff]/g; // Hiragana + Katakana
  const koreanRegex = /[\uac00-\ud7af\u1100-\u11ff]/g;

  const chineseCount = (text.match(chineseRegex) || []).length;
  const japaneseCount = (text.match(japaneseRegex) || []).length;
  const koreanCount = (text.match(koreanRegex) || []).length;

  console.log(`Language detection - CJK chars: Chinese=${chineseCount}, Japanese=${japaneseCount}, Korean=${koreanCount}`);

  // Japanese text often has hiragana/katakana mixed with kanji
  if (japaneseCount > 0) {
    return "jpn";
  }
  if (koreanCount > chineseCount) {
    return "kor";
  }
  if (chineseCount > 0) {
    return "chi_sim";
  }
  return "eng";
}

/**
 * Determine OCR language based on settings and dimensions
 */
function determineOcrLanguage(width, height) {
  if (ocrLanguage !== "auto") {
    return ocrLanguage;
  }

  const isVertical = isLikelyVerticalText(width, height);

  if (isVertical) {
    console.log("Auto-detect: Selection is tall - using jpn_vert");
    return "jpn_vert";
  } else {
    console.log("Auto-detect: Selection is wide - using chi_sim");
    return "chi_sim";
  }
}

/**
 * Quick OCR to detect language
 */
async function detectTextLanguage(imageDataUrl) {
  const result = await Tesseract.recognize(imageDataUrl, "chi_sim", {
    logger: () => {} // Silent
  });

  const detectedLang = detectLanguageFromText(result.data.text);
  console.log(`Detected language: ${detectedLang} from text: "${result.data.text.substring(0, 50)}..."`);
  return detectedLang;
}

// ============================================
// OCR EXECUTION
// ============================================

/**
 * Run OCR with a specific language
 */
async function runOcrWithLanguage(imageDataUrl, language) {
  console.log(`🔍 Running OCR with ${language}...`);

  const result = await Tesseract.recognize(imageDataUrl, language, {
    logger: (m) => {
      if (m.progress !== undefined && m.status === "recognizing text") {
        const percent = Math.round(m.progress * 100);
        updateStatus(`Recognizing (${language})...`, 45 + percent * 0.4, `${percent}%`);
      }
    }
  });

  return result.data;
}

/**
 * Smart OCR with auto language detection and retry
 */
async function ocrImage(imageDataUrl, selectionWidth = 100, selectionHeight = 100) {
  const primaryLang = determineOcrLanguage(selectionWidth, selectionHeight);

  console.log(`🔍 Starting OCR with ${primaryLang}...`);
  updateStatus(`Running OCR (${primaryLang})...`, 10, "Loading language data...");

  let result = await runOcrWithLanguage(imageDataUrl, primaryLang);

  // If auto mode and low confidence, try alternate language
  if (ocrLanguage === "auto" && result.confidence < 40) {
    console.log(`Low confidence (${result.confidence}), trying alternate...`);

    const alternateLang =
      primaryLang === "jpn_vert" ? "jpn" :
      primaryLang === "jpn" ? "jpn_vert" :
      primaryLang === "chi_sim" ? "jpn" : "chi_sim";

    updateStatus(`Low confidence, trying ${alternateLang}...`, 50);
    const altResult = await runOcrWithLanguage(imageDataUrl, alternateLang);

    if (altResult.confidence > result.confidence) {
      console.log(`Using ${alternateLang} (confidence: ${altResult.confidence} vs ${result.confidence})`);
      result = altResult;
    }
  }

  console.log("✅ OCR Complete! Confidence:", result.confidence);
  updateStatus("OCR Complete!", 85, `Confidence: ${Math.round(result.confidence)}%`);
  return result;
}

console.log("✅ ocr.js loaded");
