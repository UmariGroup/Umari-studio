
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

export class GeminiService {
  static async checkApiKey(): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      return await (window as any).aistudio.hasSelectedApiKey();
    }
    return true;
  }

  static async openKeySelector(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
    }
  }

  static async generateMarketplaceImage(
    prompt: string, 
    productImages: string[], 
    styleImages: string[], 
    aspectRatio: string = "3:4"
  ): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const model = 'gemini-2.5-flash-image'; 
      const parts: any[] = [];
      
      productImages.forEach((img) => {
        if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });

      styleImages.forEach((img) => {
        if (img) parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });

      parts.push({ 
        text: `Create a professional marketplace product shot in Tmall/Dewu style. High quality, clean background, no text. Prompt: ${prompt}` 
      });

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
      throw new Error("Rasm yaratilmadi.");
    } catch (error: any) {
      console.error("API Error:", error);
      if (error?.message?.includes("Requested entity was not found.")) {
        await this.openKeySelector();
      }
      throw new Error("Rasm yaratishda xatolik yuz berdi.");
    }
  }

  static async generateMarketplaceDescription(images: string[], categoryContext?: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const model = 'gemini-3-flash-preview';
      
      const systemInstruction = `SEN professional marketplace-copywriter va SEO mutaxassisisan.
Sening vazifang: foydalanuvchi yuborgan rasmlarni tahlil qilib, Uzum, Wildberries uchun TOVAR KARTA yaratish.

MUHIM: Natijani JSON formatida yoki qat'iy bo'limlarda qaytar.
Kategoriya bo'yicha ko'rsatma: ${categoryContext || 'Uzum/Wildberries standart kategoriyalaridan eng mosini tanla.'}

ISH QOIDALARI:
1. Rasmga qarab mahsulot turi, auditoriyasi va uslubini aniqla.
2. Xaridor OG'RIQLARINI top va YECHIM ber.
3. SEO kalit so'zlarni tabiiy joylashtir.
4. UZ va RU tillarida javob ber.

NATIJANI QAT'IY SHU FORMATDA CHIQAR (MARKDOWN):
---SARLAVHA_UZ---
[Mahsulot nomi o'zbekcha]
---SARLAVHA_RU---
[Название товара на русском]

---KATEGORIYA---
[Tavsiya etiladigan kategoriya, masalan: Elektronika > Aksessuarlar]

---TAVSIF_UZ---
[Batafsil tavsif o'zbekcha: Og'riq -> Yechim -> Foyda -> Natija]

---TAVSIF_RU---
[Подробное описание на русском]

---XUSUSIYATLAR---
- Mato: ...
- Rang: ...
- Uslub: ...
- Kim uchun: ...

---SEO---
[Kalit so'zlar ro'yxati]`;

      const parts: any[] = [];
      images.forEach(img => {
        parts.push({
          inlineData: { data: img.split(',')[1], mimeType: 'image/png' }
        });
      });
      parts.push({ text: "Iltimos, ushbu mahsulot uchun tovar kartasini va eng mos kategoriyani aniqlab bering." });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { systemInstruction, temperature: 0.3 }
      });

      return response.text || "Xatolik yuz berdi.";
    } catch (error: any) {
      console.error("Copywriter Error:", error);
      throw new Error("Tavsif yaratishda xatolik yuz berdi.");
    }
  }

  static async chat(message: string, images: string[] = []): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const model = 'gemini-3-flash-preview';
      const systemInstruction = `Siz Umari Studio AI mutaxassisisiz. O'zbek tilida professional va yordam beruvchi ruhda javob bering.`;
      const parts: any[] = [];
      images.forEach(img => {
        parts.push({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } });
      });
      parts.push({ text: message });
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { systemInstruction, temperature: 0.7 }
      });
      return response.text || "Xatolik yuz berdi.";
    } catch (error: any) {
      console.error("Chat Error:", error);
      if (error?.message?.includes("Requested entity was not found.")) {
        await this.openKeySelector();
      }
      throw new Error("Chatda xatolik yuz berdi.");
    }
  }

  static async generateVideoFromImage(sourceImage: string, prompt: string, isPortrait: boolean): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
    } catch (error: any) {
      console.error("Video Error:", error);
      if (error?.message?.includes("Requested entity was not found.")) {
        await this.openKeySelector();
      }
      throw new Error("Video yaratishda xatolik yuz berdi.");
    }
  }
}
