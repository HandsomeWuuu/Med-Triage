# Med-Triage APP 工作流程与 Gemini Prompts 详解

## 📋 目录
1. [系统架构概览](#系统架构概览)
2. [完整工作流程](#完整工作流程)
3. [阶段一：问诊对话流程](#阶段一问诊对话流程)
4. [阶段二：诊断分析流程](#阶段二诊断分析流程)
5. [数据流转详解](#数据流转详解)
6. [关键技术点](#关键技术点)

---

## 系统架构概览

```
┌─────────────┐
│   用户界面   │  (app/page.tsx)
└──────┬──────┘
       │
       ├──────────────────┬────────────────┐
       │                  │                │
       ▼                  ▼                ▼
┌────────────┐    ┌─────────────┐  ┌──────────────┐
│ Chat API   │    │ Analyze API │  │ UI Components│
│ /api/chat  │    │ /api/analyze│  │ (诊断面板等) │
└─────┬──────┘    └──────┬──────┘  └──────────────┘
      │                  │
      ▼                  ▼
┌────────────────────────────────┐
│      Gemini 2.5 Flash API      │
│   (Google GenAI SDK)           │
└────────────────────────────────┘
```

---

## 完整工作流程

### 流程图

```
开始
  │
  ▼
[1] 初始化对话
  │  └─> 显示欢迎消息（前端预设）
  │
  ▼
[2] 用户输入主诉症状
  │  └─> 发送 POST /api/chat
  │
  ▼
[3] Gemini 生成问诊问题 + 选项
  │  └─> 返回结构化 JSON (question, options, allowMultiple)
  │
  ▼
[4] 用户选择选项或输入文本
  │  └─> 重复步骤 2-4 (3-5 轮问诊)
  │
  ▼
[5] 用户点击"更新分析"
  │  └─> 发送 POST /api/analyze
  │
  ▼
[6] Gemini 分析对话历史
  │  └─> 生成鉴别诊断 + 症状关联
  │  └─> 返回结构化 JSON (diagnoses, symptomConnections)
  │
  ▼
[7] 前端展示分析结果
  │  ├─> 诊断面板（DiagnosisPanel）
  │  └─> 桑基图（SankeyChart）
  │
  ▼
结束（可重置对话）
```

---

## 阶段一：问诊对话流程

### 📍 触发入口
- **文件**: `app/page.tsx` → `handleSendMessage()`
- **API 端点**: `POST /api/chat/route.ts`

### 🔄 数据流

```typescript
// 前端发送请求
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    history: Message[],    // 历史对话记录
    message: string        // 用户当前消息
  })
})

// 后端返回响应
{
  text: string,           // AI 的问题
  options: string[],      // 4-6 个预设选项
  allowMultiple: boolean  // 是否允许多选
}
```

### 💬 Prompt 设计

#### **System Instruction** (系统指令)
```plaintext
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
```

#### **Response Schema** (结构化输出)
```typescript
{
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
}
```

#### **Gemini 调用配置**
```typescript
ai.models.generateContent({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
    temperature: 0.5,              // 适度创造性
    responseMimeType: "application/json",
    responseSchema: CHAT_RESPONSE_SCHEMA
  },
  contents: [
    // 历史对话
    { role: 'user', parts: [{ text: '头痛' }] },
    { role: 'model', parts: [{ text: '疼痛在哪个位置？' }] },
    // 当前用户消息
    { role: 'user', parts: [{ text: '前额' }] }
  ]
})
```

### 📊 实际交互示例

**第 1 轮**
```json
// 用户输入
"头痛"

// Gemini 返回
{
  "question": "疼痛在哪个位置？",
  "options": ["前额", "后脑勺", "太阳穴", "整个头部", "其他"],
  "allowMultiple": false
}
```

**第 2 轮**
```json
// 用户选择
"前额"

// Gemini 返回
{
  "question": "还有以下伴随症状吗？",
  "options": ["恶心", "呕吐", "畏光", "发烧", "无"],
  "allowMultiple": true
}
```

---

## 阶段二：诊断分析流程

### 📍 触发入口
- **文件**: `app/page.tsx` → `handleAnalyze()`
- **API 端点**: `POST /api/analyze/route.ts`

### 🔄 数据流

```typescript
// 前端发送请求
fetch('/api/analyze', {
  method: 'POST',
  body: JSON.stringify({
    history: Message[]    // 完整对话历史
  })
})

// 后端返回响应
{
  diagnoses: Diagnosis[],              // 3-5 个鉴别诊断
  symptomConnections: SymptomConnection[]  // 症状-疾病关联
}
```

### 🧠 Prompt 设计

#### **Prompt 构建**
```typescript
const conversationText = history
  .map(m => `${m.role}: ${m.text}`)
  .join('\n');

const prompt = `
Based on the following patient interview transcript, generate a differential diagnosis and map symptoms to conditions.
Output ONLY valid JSON matching the schema.
IMPORTANT: All text fields (name, description, recommendedAction, symptom, condition) MUST be in Simplified Chinese (简体中文).
The 'urgency' field must remain one of the English enum values: "Low", "Medium", "High", "Critical".

TRANSCRIPT:
${conversationText}
`;
```

#### **示例输入**
```plaintext
TRANSCRIPT:
user: 头痛
model: 疼痛在哪个位置？
user: 前额
model: 还有以下伴随症状吗？
user: 恶心, 畏光
model: 疼痛持续多久了？
user: 2天
```

#### **Response Schema** (结构化输出)
```typescript
{
  type: Type.OBJECT,
  properties: {
    diagnoses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "疾病名称（中文）" },
          probability: { type: Type.INTEGER, description: "概率 0-100" },
          description: { type: Type.STRING, description: "符合理由（中文）" },
          urgency: { 
            type: Type.STRING, 
            enum: ["Low", "Medium", "High", "Critical"]
          },
          recommendedAction: { type: Type.STRING, description: "建议处置（中文）" }
        },
        required: ["name", "probability", "description", "urgency", "recommendedAction"]
      }
    },
    symptomConnections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          symptom: { type: Type.STRING, description: "症状（中文）" },
          condition: { type: TYPE.STRING, description: "疾病（中文）" },
          strength: { type: Type.INTEGER, description: "关联强度 1-10" }
        },
        required: ["symptom", "condition", "strength"]
      }
    }
  },
  required: ["diagnoses", "symptomConnections"]
}
```

#### **Gemini 调用配置**
```typescript
ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: ANALYSIS_SCHEMA,
    temperature: 0.2,    // 低温度保证一致性
  }
})
```

### 📊 实际返回示例

```json
{
  "diagnoses": [
    {
      "name": "偏头痛",
      "probability": 75,
      "description": "前额疼痛伴恶心、畏光，持续2天，符合偏头痛典型症状",
      "urgency": "Medium",
      "recommendedAction": "建议神经内科门诊就诊，可服用止痛药"
    },
    {
      "name": "紧张性头痛",
      "probability": 20,
      "description": "压力或疲劳引起的头痛，但伴随症状较少",
      "urgency": "Low",
      "recommendedAction": "休息观察，如症状持续建议门诊就诊"
    },
    {
      "name": "脑膜炎",
      "probability": 5,
      "description": "低概率但需排除，若伴发热、颈部僵硬需警惕",
      "urgency": "Critical",
      "recommendedAction": "如出现发热、意识改变，立即急诊就诊"
    }
  ],
  "symptomConnections": [
    { "symptom": "前额疼痛", "condition": "偏头痛", "strength": 8 },
    { "symptom": "恶心", "condition": "偏头痛", "strength": 7 },
    { "symptom": "畏光", "condition": "偏头痛", "strength": 6 },
    { "symptom": "前额疼痛", "condition": "紧张性头痛", "strength": 5 }
  ]
}
```

---

## 数据流转详解

### 📦 核心数据结构

#### **Message** (对话消息)
```typescript
interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  options?: string[];       // AI 提供的选项
  allowMultiple?: boolean;  // 是否多选
}
```

#### **Diagnosis** (诊断结果)
```typescript
interface Diagnosis {
  name: string;              // 疾病名称
  probability: number;       // 0-100
  description: string;       // 理由说明
  urgency: UrgencyLevel;     // Low/Medium/High/Critical
  recommendedAction: string; // 建议处置
}
```

#### **SymptomConnection** (症状关联)
```typescript
interface SymptomConnection {
  symptom: string;     // 症状
  condition: string;   // 疾病
  strength: number;    // 关联强度 1-10
}
```

### 🔄 状态管理

```typescript
// app/page.tsx 中的核心状态
const [messages, setMessages] = useState<Message[]>([]);          // 对话历史
const [input, setInput] = useState('');                           // 用户输入
const [isTyping, setIsTyping] = useState(false);                  // 加载状态
const [isAnalyzing, setIsAnalyzing] = useState(false);            // 分析状态
const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
```

---

## 关键技术点

### 🎯 1. 结构化输出 (Structured Output)
- 使用 `responseMimeType: "application/json"` 强制 JSON 输出
- 通过 `responseSchema` 定义严格的数据结构
- 避免了传统 prompt 工程中的解析问题

### 🌡️ 2. Temperature 参数调优
- **问诊阶段** (`temperature: 0.5`): 适度创造性，生成多样化问题
- **分析阶段** (`temperature: 0.2`): 低温度保证诊断一致性和准确性

### 🔐 3. API Key 安全
- 使用环境变量 `process.env.GEMINI_API_KEY`
- **仅在服务器端** (`/api/*` 路由) 调用 Gemini API
- 前端通过 Next.js API Routes 代理请求

### 📝 4. 对话历史管理
- 每次请求都发送完整对话历史
- Gemini 根据上下文生成个性化问题
- 历史仅包含 `text` 内容，不传递 UI 元数据（如 `options`）

### 🎨 5. UI/UX 优化
- **单选/多选动态切换**: 根据 `allowMultiple` 自动调整
- **加载状态**: `isTyping`, `isAnalyzing` 提供视觉反馈
- **实时滚动**: 新消息自动滚动到底部
- **Sankey 图**: 可视化症状-疾病关联强度

### 🔄 6. 错误处理
```typescript
try {
  const response = await fetch('/api/chat', {...});
  if (!response.ok) throw new Error('Failed');
  // ...处理响应
} catch (error) {
  console.error(error);
  // 显示友好错误消息
}
```

---

## 🚀 未来优化方向

1. **多轮追问深化**: 根据用户选择动态调整问题深度
2. **风险评估**: 基于症状组合计算紧急度评分
3. **就医路径推荐**: 结合地理位置推荐医院科室
4. **对话摘要**: 生成标准化病历主诉
5. **多语言支持**: 扩展到繁体中文、英文等

---

## 📚 参考资源

- **Gemini API 文档**: https://ai.google.dev/docs
- **Google GenAI SDK**: `@google/genai`
- **Next.js API Routes**: https://nextjs.org/docs/api-routes/introduction
- **TypeScript 类型定义**: `/types.ts`

---

**文档版本**: 1.0  
**最后更新**: 2025-12-11  
**作者**: GitHub Copilot
