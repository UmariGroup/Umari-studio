
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

  static async enhancePrompt(userPrompt: string): Promise<string> {
    try {
      // Create a new instance right before making an API call to ensure it always uses the most up-to-date API key.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const model = 'gemini-3-flash-preview';
      const response = await ai.models.generateContent({
        model,
        contents: `Quyidagi qisqa mahsulot tavsifini professional marketplace promptiga aylantirib ber. Faqat prompt matnini ingliz tilida qaytar: "${userPrompt}"`,
      });
      return response.text || userPrompt;
    } catch (error) {
      console.error("Enhance Prompt Error:", error);
      return userPrompt;
    }
  }

  static async generateMarketplaceImage(
    prompt: string,
    productImages: string[],
    styleImages: string[],
    aspectRatio: string
  ): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      // Use explicit type or spread to avoid narrowing issues with heterogeneous parts.
      const parts: any[] = [
        ...productImages.filter(img => img).map(img => ({
          inlineData: { data: img.split(',')[1], mimeType: 'image/png' }
        })),
        ...styleImages.filter(img => img).map(img => ({
          inlineData: { data: img.split(',')[1], mimeType: 'image/png' }
        })),
        { 
          text: `Task: Generate a high-quality professional marketplace product image. Background/Setting: ${prompt}. Focus: Keep products as primary subject. Style: Commercial studio lighting.` 
        }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: { imageConfig: { aspectRatio: aspectRatio as any } }
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data found.");
    } catch (error: any) {
      throw new Error("Rasm yaratishda xatolik.");
    }
  }

  static async *generateMarketplaceDescriptionStream(images: string[], marketplace: string, additionalInfo?: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const model = 'gemini-3-pro-preview';
    
    const systemInstruction = `Siz professional marketplace-copywriter va SEO mutaxassisiz.
Vazifa: Yuklangan rasmlar asosida ${marketplace} platformasi uchun 18 ta blokdan iborat kartani yaratish.

MUHIM QOIDALAR:
1. HAR BIR blokni ---KEY_NAME--- markeridan boshlang.
2. Har bir band ichida "UZ:" va "RU:" prefikslaridan foydalaning.
3. Toza matn: markdown (#, *, _) ishlatmang.
4. KAFOLAT: FAQAT "10 kun (ishlab chiqaruvchi nuqsonlari uchun)" deb yozing.

MARKERLAR:
---CAT---, ---NAME---, ---COUNTRY---, ---BRAND---, ---MODEL---, ---WARRANTY---, ---SHORT_DESC---, ---FULL_DESC---, ---PHOTOS_INFO---, ---VIDEO_REC---, ---SPECS---, ---PROPS---, ---INSTR---, ---SIZE---, ---COMP---, ---CARE---, ---SKU---, ---IKPU---`;

    // Construct parts array carefully to avoid TypeScript narrowing errors that prevent mixing inlineData and text.
    const parts: any[] = [
      ...images.map(img => ({
        inlineData: { data: img.split(',')[1], mimeType: 'image/png' }
      })),
      { text: `Ushbu mahsulot uchun ${marketplace} standartida 18 banddan iborat professional kartani tayyorlang. Qo'shimcha ma'lumot: ${additionalInfo || 'Yo\'q'}` }
    ];

    const stream = await ai.models.generateContentStream({
      model,
      contents: { parts },
      config: { systemInstruction, temperature: 0.1 }
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  static async chat(message: string, images: string[] = []): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const parts: any[] = [
      ...images.map(img => ({ inlineData: { data: img.split(',')[1], mimeType: 'image/png' } })),
      { text: message }
    ];
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: { systemInstruction: "Siz Umari Studio AI mutaxassisisiz.", temperature: 0.7 }
    });
    return response.text || "";
  }

  /**
   * Generates a video from an image using the Veo model.
   * Implements mandatory polling and error handling for API keys.
   */
  static async generateVideoFromImage(image: string, prompt: string, isPortrait: boolean): Promise<string> {
    try {
      // Always create a new instance right before the call to ensure up-to-date API key.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: {
          imageBytes: image.split(',')[1],
          mimeType: 'image/png',
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: isPortrait ? '9:16' : '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        // Re-initialize for each poll to ensure correct key context.
        const pollAi = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        operation = await pollAi.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video generation failed.");
      
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!response.ok) throw new Error("Failed to download video.");
      
      const videoBlob = await response.blob();
      return URL.createObjectURL(videoBlob);
    } catch (error: any) {
      // If requested entity not found, reset key selection as per Veo guidelines.
      if (error.message?.includes("Requested entity was not found.")) {
        await this.openKeySelector();
        throw new Error("Iltimos, API kalitni qayta tanlang.");
      }
      throw error;
    }
  }
}
