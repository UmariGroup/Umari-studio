
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";

export class GeminiService {
  private static getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    console.error("API Error:", errorMessage);

    if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("not found")) {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        (window as any).aistudio.openSelectKey();
      }
      throw new Error("Loyiha topilmadi yoki billing bilan bog'liq xatolik. Iltimos, API sozlamalarini tekshiring.");
    }

    throw error;
  }

  static async generateMarketplaceImage(
    prompt: string, 
    productImages: string[], 
    styleImages: string[], // Bir nechta uslub rasmlari
    aspectRatio: string = "3:4"
  ): Promise<string> {
    try {
      const ai = this.getAI();
      const model = 'gemini-2.5-flash-image';
      
      const parts: any[] = [];
      
      // Mahsulot rasmlari
      productImages.forEach((img) => {
        if (img) {
          parts.push({
            inlineData: {
              data: img.split(',')[1],
              mimeType: 'image/png'
            }
          });
        }
      });

      // Uslub rasmlari
      styleImages.forEach((img) => {
        if (img) {
          parts.push({
            inlineData: {
              data: img.split(',')[1],
              mimeType: 'image/png'
            }
          });
        }
      });

      const instruction = `
        UMARI STUDIO PROFESSIONAL:
        1. Primary product references provided in the first ${productImages.length} images.
        2. Style and environment references provided in the following ${styleImages.length} images.
        3. TASK: Create a single high-quality marketplace image.
        4. Integrate the product details from all product angles.
        5. Mimic the combined aesthetic, lighting, and composition of the style references.
        6. Style priority: High. The result must look like a fusion of the style references provided.
        ${prompt ? `Extra instructions: ${prompt}` : ""}
      `;
      parts.push({ text: instruction });

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
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Rasm yaratishda xatolik yuz berdi");
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
            {
              inlineData: {
                data: originalImageBase64.split(',')[1],
                mimeType: 'image/png'
              }
            },
            { text: `UMARI STUDIO EDIT: ${instruction}. Professional marketplace quality.` }
          ]
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Tahrirlashda xatolik yuz berdi");
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
        config: {
          systemInstruction: "Siz Umari Studio Production AI assistanti Umarbeksiz. Marketpleyslar uchun rasm tayyorlash bo'yicha mutaxassis. Faqat o'zbek tilida gapiring. Juda qisqa va aniq javob bering."
        }
      });

      const response = await chat.sendMessage({ message });
      return response.text || "Xatolik yuz berdi.";
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
        image: {
          imageBytes: dataPart,
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: isPortrait ? '9:16' : '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video download linki topilmadi.");

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!response.ok) throw new Error("Video faylini yuklab olishda xatolik yuz berdi.");
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      return this.handleApiError(error);
    }
  }
}
