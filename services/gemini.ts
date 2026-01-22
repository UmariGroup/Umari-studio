
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";

export class GeminiService {
  private static getAI() {
    // Har doim yangi GoogleGenAI instance yaratamiz — brauzer muhitida VITE env yoki aistudio orqali kalitni oladi.
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      // Agar aistudio select/manager API taqdim etsa, undan kalitni olishga harakat qilamiz.
      const aistudioKey = (window as any).aistudio.getSelectedApiKey ? (window as any).aistudio.getSelectedApiKey() : undefined;
      const apiKey = aistudioKey ?? (import.meta.env.VITE_API_KEY as string | undefined);
      if (!apiKey) {
        throw new Error("API kalit topilmadi. ‘API Kalitni Tanlash’ tugmasini bosib yoki .env.local ichiga VITE_API_KEY ni qo'ying.");
      }
      return new GoogleGenAI({ apiKey });
    }

    const key = import.meta.env.VITE_API_KEY as string | undefined;
    if (!key) {
      throw new Error("API kalit brauzer muhitida topilmadi. Iltimos, .env.local fayliga VITE_API_KEY qo'ying yoki server-side proxy ishlating.");
    }
    return new GoogleGenAI({ apiKey: key });
  }

  static async checkApiKey() {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      return await (window as any).aistudio.hasSelectedApiKey();
    }
    return true;
  }

  static async openKeySelector() {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
    }
  }

  private static handleApiError(error: any): never {
    const errorMessage = error?.message || String(error);
    console.error("API Error Detailed:", error);

    // 403 Permission Denied yoki Not Found xatolarida kalit tanlash dialogini qayta ochamiz
    if (
      errorMessage.includes("Requested entity was not found") || 
      errorMessage.includes("permission") || 
      errorMessage.includes("403") ||
      errorMessage.includes("not found")
    ) {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        window.aistudio.openSelectKey();
      }
      throw new Error("API kalit topilmadi yoki ruxsat yo'q. Iltimos, billing yoqilgan API kalitni qayta tanlang.");
    }

    throw error;
  }

  static async generateMarketplaceImage(
    prompt: string, 
    productImages: string[], 
    styleImages: string[], 
    aspectRatio: string = "3:4"
  ): Promise<string> {
    try {
      // If running in the browser, forward to the server-side proxy so the API key stays secret
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, productImages, styleImages, aspectRatio })
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Server proxy error');
        }
        const json = await res.json();
        return json.image;
      }

      const ai = this.getAI();
      const model = 'gemini-2.5-flash-image';
      const parts: any[] = [];
      
      productImages.forEach((img) => {
        if (img) {
          parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
        }
      });

      styleImages.forEach((img) => {
        if (img) {
          parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
        }
      });

      const instruction = `UMARI STUDIO PROFESSIONAL: Create a marketplace image. Use provided styles. The image must include a clear call-to-action button that reads \"Ishni boshlash\" (Uzbek) — do NOT use the word \"Yaratish\". Keep the UMARI logo intact and unchanged in its colors and placement. ${prompt}`;
      parts.push({ text: instruction });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio as any } }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Rasm yaratilmadi.");
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  static async editImage(originalImageBase64: string, instruction: string): Promise<string> {
    try {
      const ai = this.getAI();
      const model = 'gemini-2.5-flash-image';
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { data: originalImageBase64.split(',')[1], mimeType: 'image/png' } },
            { text: `UMARI STUDIO EDIT: ${instruction}` }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Tahrirlashda xatolik.");
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  static async chat(message: string, history: {role: 'user'|'model', text: string}[]): Promise<string> {
    try {
      const ai = this.getAI();
      const model = 'gemini-3-flash-preview';
      const chat = ai.chats.create({
        model,
        config: { systemInstruction: "Siz Umari Studio mutaxassisisiz. Faqat o'zbek tilida qisqa javob bering." }
      });
      const response = await chat.sendMessage({ message });
      return response.text || "Xatolik.";
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  static async generateVideoFromImage(sourceImage: string, prompt: string, isPortrait: boolean): Promise<string> {
    try {
      const ai = this.getAI();
      const [mimePart, dataPart] = sourceImage.split(',');
      const mimeType = mimePart.match(/:(.*?);/)?.[1] || 'image/png';
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: { imageBytes: dataPart, mimeType: mimeType },
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: isPortrait ? '9:16' : '16:9' }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video linki topilmadi.");

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!response.ok) throw new Error("Yuklash xatosi.");
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      return this.handleApiError(error);
    }
  }
}
