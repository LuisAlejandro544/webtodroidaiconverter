import { GoogleGenAI, Type } from "@google/genai";
import { AndroidPermissions } from "../types";

// Inicializar el cliente
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key no encontrada. Por favor configúrala.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Utiliza Gemini 3 Pro con Thinking Mode para analizar el código HTML
 * y deducir qué permisos de Android son necesarios.
 */
export const analyzeCodeForPermissions = async (htmlCode: string): Promise<AndroidPermissions> => {
  const ai = getAiClient();
  
  const prompt = `
    Act as a senior Android Engineer. I have a web application code (HTML/JS). 
    I need to wrap this in an Android WebView.
    
    Analyze the following code deeply to understand what native device features it likely accesses.
    Determine which AndroidManifest.xml permissions are required.
    
    Code snippet (first 15000 chars):
    ${htmlCode.substring(0, 15000)}
    
    Think carefully about implied usage (e.g., <input type="file"> might need storage, navigator.geolocation needs location).
    Return the result in JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // MAX Thinking budget para análisis profundo
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            usesInternet: { type: Type.BOOLEAN },
            usesCamera: { type: Type.BOOLEAN },
            usesLocation: { type: Type.BOOLEAN },
            usesMicrophone: { type: Type.BOOLEAN },
            usesStorage: { type: Type.BOOLEAN },
            customPermissions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Any other specific permissions like BLUETOOTH, VIBRATE, etc." 
            },
            reasoning: { type: Type.STRING, description: "Detailed explanation of why these permissions were chosen based on the code analysis." }
          },
          required: ["usesInternet", "usesCamera", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as AndroidPermissions;

  } catch (error) {
    console.error("Error analyzing code:", error);
    // Fallback por defecto si falla
    return {
      usesInternet: true,
      usesCamera: false,
      usesLocation: false,
      usesMicrophone: false,
      usesStorage: false,
      customPermissions: [],
      reasoning: "Error en el análisis automático. Se han establecido permisos básicos."
    };
  }
};

/**
 * Genera un icono de aplicación utilizando Gemini Image Model.
 */
export const generateAppIcon = async (appName: string, description: string): Promise<string> => {
  const ai = getAiClient();
  
  const prompt = `
    Design a modern, minimalist, vector-style app icon for an Android application named "${appName}".
    Description of the app: ${description}.
    The icon should be suitable for a mobile launcher (rounded square or adaptive shape).
    High contrast, professional color palette. Flat design.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        responseMimeType: "image/png"
      }
    });

    // Buscar la parte de la imagen
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Error generating icon:", error);
    // Placeholder si falla
    return "https://picsum.photos/512/512";
  }
};