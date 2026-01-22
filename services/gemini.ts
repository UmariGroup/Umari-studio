
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

export class GeminiService {
  private static getAI() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API kaliti topilmadi.");
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Bepul tier uchun kalit tekshirishni soddalashtiramiz
   */
  static async checkApiKey(): Promise<boolean> {
    return !!process.env.API_KEY;
  }

  /**
   * Billing dialogini ochish funksiyasi (faqat kerak bo'lganda chaqiriladi)
   */
  static async openKeySelector() {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
    }
  }

  private static handleApiError(error: any): never {
    const errorMessage = error?.message || String(error);
    console.error("API Error:", error);

    if (errorMessage.includes("403") || errorMessage.includes("permission") || errorMessage.includes("billing")) {
      throw new Error("Ushbu funksiya uchun billing talab qilinishi mumkin. Iltimos, rasm yaratishdan foydalaning (u bepul).");
    }

    throw new Error(errorMessage);
  }

  static async generateMarketplaceImage(
    prompt: string, 
    productImages: string[], 
    styleImages: string[], 
    aspectRatio: string = "3:4"
  ): Promise<string> {
    try {
      const ai = this.getAI();
      // BEPUL TIER MODELI: gemini-2.5-flash-image
      const model = 'gemini-2.5-flash-image'; 
      const parts: any[] = [];
      
      productImages.forEach((img) => {
        if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });

      styleImages.forEach((img) => {
        if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });

      parts.push({ 
        text: `Create a professional marketplace product shot. 
        Style: High-end Chinese marketplace (Tmall/Dewu style). 
        Quality: 4k, cinematic, clean background. 
        NO arrows, NO text, NO UI elements. 
        User instruction: ${prompt}` 
      });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { 
          imageConfig: { 
            aspectRatio: aspectRatio as any
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("Rasm yaratilmadi.");
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  static async chat(message: string, history: {role: 'user'|'model', text: string}[]): Promise<string> {
    try {
      const ai = this.getAI();
      const model = 'gemini-3-flash-preview'; // Bepul tierda mukammal ishlaydi
      const chat = ai.chats.create({
        model,
        config: { systemInstruction: "Siz Umari Studio mutaxassisisiz. O'zbek tilida qisqa va foydali javob bering." }
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
      // DIQQAT: Veo (Video) modeli har doim billing talab qiladi.
      // Foydalanuvchi bepul ishlatishi uchun bu qismda billing dialogini ochishga majburmiz.
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
        }
      }

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
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      return this.handleApiError(error);
    }
  }
}
