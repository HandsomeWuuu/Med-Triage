import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, Message } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System instruction for the chat interaction
const CHAT_SYSTEM_INSTRUCTION = `
You are an expert Medical Triage Nurse AI, communicating in Simplified Chinese (简体中文).
Your goal is to interview the patient to understand their "Chief Complaint" (主诉).

CRITICAL RULES:
1. ASK FEW QUESTIONS: Patients are impatient. Ask only 3-5 high-impact questions total to determine severity and key symptoms.
2. BE CONCISE: Questions must be short (under 20 words).
3. GENERATE OPTIONS: You MUST provide a list of 4-6 predefined short options (answers) in Chinese.
   - If inquiring about specific pain/location, use Single Choice.
   - If inquiring about associated symptoms (e.g., "Do you also have...?"), use Multiple Choice.
   - Always include "其他" (Other) or "无" (None).

Tone: Professional, empathetic, efficient.
`;

// Schema for the chat response with options
const CHAT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: { 
      type: Type.STRING, 
      description: "The follow-up question to the patient in Chinese." 
    },
    options: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "A list of 4-6 short, likely answers in Chinese for the user to click."
    },
    allowMultiple: { 
      type: Type.BOOLEAN,
      description: "True if the user can select multiple options, False for single choice."
    }
  },
  required: ["question", "options", "allowMultiple"]
};

// Schema for the structured analysis output
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    diagnoses: {
      type: Type.ARRAY,
      description: "List of top 3-5 potential differential diagnoses.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the medical condition in Chinese." },
          probability: { type: Type.INTEGER, description: "Estimated probability percentage (0-100)." },
          description: { type: Type.STRING, description: "Brief explanation of why this fits in Chinese." },
          urgency: { 
            type: Type.STRING, 
            enum: ["Low", "Medium", "High", "Critical"],
            description: "Triage urgency level (Keep these enum values in English for code logic)."
          },
          recommendedAction: { type: Type.STRING, description: "Next step (e.g., 'Go to ER') in Chinese." }
        },
        required: ["name", "probability", "description", "urgency", "recommendedAction"]
      }
    },
    symptomConnections: {
      type: Type.ARRAY,
      description: "Relationships between identified symptoms and the suspected conditions for a Sankey diagram.",
      items: {
        type: Type.OBJECT,
        properties: {
          symptom: { type: Type.STRING, description: "The specific symptom reported in Chinese." },
          condition: { type: Type.STRING, description: "The condition it points to in Chinese." },
          strength: { type: Type.INTEGER, description: "Strength of the correlation (1-10)." }
        },
        required: ["symptom", "condition", "strength"]
      }
    }
  },
  required: ["diagnoses", "symptomConnections"]
};

export const sendMessageToTriageBot = async (history: Message[], newMessage: string): Promise<{ text: string, options: string[], allowMultiple: boolean }> => {
  try {
    const model = "gemini-2.5-flash";
    
    // Convert generic Message type to Gemini content format
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }] // Only send text history, ignore previous options meta
    }));
    
    // Add the new user message
    contents.push({
      role: 'user',
      parts: [{ text: newMessage }]
    });

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: CHAT_RESPONSE_SCHEMA
      },
      contents: contents
    });

    const jsonText = response.text;
    if (jsonText) {
      const parsed = JSON.parse(jsonText);
      return {
        text: parsed.question,
        options: parsed.options || [],
        allowMultiple: parsed.allowMultiple || false
      };
    }

    return { text: "抱歉，系统暂时无法处理，请重试。", options: [], allowMultiple: false };
  } catch (error) {
    console.error("Error in triage chat:", error);
    return { text: "系统错误：无法连接到分诊服务。", options: [], allowMultiple: false };
  }
};

export const analyzeMedicalContext = async (history: Message[]): Promise<AnalysisResult | null> => {
  try {
    const model = "gemini-2.5-flash"; // Using Flash for speed

    // Construct a prompt context from history
    const conversationText = history.map(m => `${m.role}: ${m.text}`).join('\n');
    const prompt = `
      Based on the following patient interview transcript, generate a differential diagnosis and map symptoms to conditions.
      Output ONLY valid JSON matching the schema.
      IMPORTANT: All text fields (name, description, recommendedAction, symptom, condition) MUST be in Simplified Chinese (简体中文).
      The 'urgency' field must remain one of the English enum values: "Low", "Medium", "High", "Critical".
      
      TRANSCRIPT:
      ${conversationText}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.2, // Low temperature for consistent analysis
      }
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    return JSON.parse(jsonText) as AnalysisResult;

  } catch (error) {
    console.error("Error generating medical analysis:", error);
    return null;
  }
};