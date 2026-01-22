import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Server will accept requests but Google API calls will fail.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

app.post('/api/generate', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY' });

    const { prompt = '', productImages = [], styleImages = [], aspectRatio = '3:4' } = req.body;

    const model = 'gemini-2.5-flash-image';
    const parts = [];

    [...productImages, ...styleImages].forEach((img) => {
      if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
    });

    parts.push({ text: `UMARI STUDIO PROFESSIONAL: Create a marketplace image. Use provided styles. The image must include a clear call-to-action button that reads "Ishni boshlash" (Uzbek) — do NOT use the word "Yaratish". Keep the UMARI logo intact and unchanged in its colors and placement. ${prompt}` });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: { imageConfig: { aspectRatio } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.json({ image: `data:image/png;base64,${part.inlineData.data}` });
      }
    }

    return res.status(500).json({ error: 'Image not generated' });
  } catch (err) {
    console.error('Error generating image:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server proxy listening on http://localhost:${PORT}`);
});