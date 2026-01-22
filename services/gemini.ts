
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

export class GeminiService {
  private static getAI() {
    const apiKey = process.env.API_KEY || "";
    if (!apiKey) {
      // API kalit bo'lmasa ham SDK'ni boshlamaslikka harakat qilamiz, 
      // chunki SDK ichkarida "API Key must be set" xatosini tashlaydi.
      throw new Error("API_KEY_MISSING");
    }
    return new GoogleGenAI({ apiKey });
  }

  static async checkApiKey() {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      return await (window as any).aistudio.hasSelectedApiKey();
    }
    return !!process.env.API_KEY;
  }

  static async openKeySelector() {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
    }
  }

  private static handleApiError(error: any): never {
    const errorMessage = error?.message || String(error);
    console.error("API Error Detailed:", error);

    // Agar xatolik kalit bilan bog'liq bo'lsa
    if (
      errorMessage.includes("API_KEY_MISSING") ||
      errorMessage.includes("permission") || 
      errorMessage.includes("403") || 
      errorMessage.includes("not found") ||
      errorMessage.includes("API Key")
    ) {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        window.aistudio.openSelectKey();
      }
      throw new Error("API ruxsat xatosi (403). Iltimos, Gemini API kalitini qayta tanlang yoki to'lov holatini tekshiring.");
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
      const ai = this.getAI();
      // Bepul/Flash tier uchun gemini-2.5-flash-image'dan foydalanamiz
      const model = 'gemini-2.5-flash-image'; 
      const parts: any[] = [];
      
      productImages.forEach((img) => {
        if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });

      styleImages.forEach((img) => {
        if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });

      parts.push({ text: `Professional marketplace product photography, high resolution, clean background. Instruction: ${prompt}` });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { 
          imageConfig: { aspectRatio: aspectRatio as any }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Rasm generatsiya qilinmadi.");
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
        config: { systemInstruction: "Siz Umari Studio mutaxassisisiz. O'zbek tilida qisqa va aniq javob bering." }
      });
      const response = await chat.sendMessage({ message });
      return response.text || "Javob olib bo'lmadi.";
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  static async generateVideoFromImage(sourceImage: string, prompt: string, isPortrait: boolean): Promise<string> {
    try {
      const ai = this.getAI();
      const dataPart = sourceImage.split(',')[1];
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: { imageBytes: dataPart, mimeType: 'image/png' },
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: isPortrait ? '9:16' : '16:9' }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video topilmadi.");

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      return this.handleApiError(error);
    }
  }
}
