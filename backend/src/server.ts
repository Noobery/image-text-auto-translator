import express from "express";
import cors from "cors";
import ollama from "ollama";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

interface TranslateRequestBody {
  text: string;
  sourceLang?: string; // e.g. "ja", optional
  targetLang: string;  // e.g. "en"
}

async function translateWithOllama({
  text,
  sourceLang,
  targetLang,
}: TranslateRequestBody): Promise<string> {
  // Enhanced prompt for manga/comic dialogue translation
  const prompt = `Translate this manga/comic text to natural ${targetLang}:

${text}

Provide only the translation, making it sound natural as dialogue or narration.`;

  const response = await ollama.chat({
    model: "aya:8b",
    messages: [
      {
        role: "system",
        content: `You are an expert manga and comic translator. Your job is to:

1. UNDERSTAND the context: This is dialogue or narration from a manga/comic. The text may be fragmented, have unusual line breaks, or contain sound effects.

2. RECONSTRUCT meaning: Piece together fragments into coherent sentences. If text appears broken or out of order (common in OCR), infer the intended reading order.

3. TRANSLATE naturally: Convert to natural, conversational ${targetLang} that sounds like how people actually speak. For dialogue, make it sound like real conversation. For narration, make it flow smoothly.

4. PRESERVE tone: Keep emotional tone (angry, sad, excited, sarcastic) and speaking style (formal, casual, childish, dramatic).

5. HANDLE special elements:
   - Sound effects: Translate or transliterate appropriately (e.g., ドキドキ → *thump thump* or *heart pounding*)
   - Emphasis: Preserve emphasis using caps, italics notation, or punctuation
   - Incomplete sentences: Complete them naturally if meaning is clear

OUTPUT: Only the final natural translation. No explanations, notes, or alternatives.`
      },
      { 
        role: "user", 
        content: prompt 
      }
    ],
    options: {
      temperature: 0.3, // Slightly higher for more natural language
    }
  });

  return response.message.content.trim();
}

app.post("/translate", async (req, res): Promise<void> => {
  const { text, sourceLang, targetLang } = req.body as TranslateRequestBody;

  if (!text || !targetLang) {
    res.status(400).json({ error: "text and targetLang are required" });
    return;
  }

  try {
    const translated = await translateWithOllama({ text, sourceLang, targetLang });
    res.json({ translated });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: "translation_failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Translation server running at http://localhost:${PORT}`);
});
