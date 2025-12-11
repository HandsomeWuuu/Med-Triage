# AI 智能分诊系统 (Next.js 版本)

基于 AI 的医疗分诊和诊断可视化系统，使用 Next.js 构建的前后端一体化应用。

## 🔒 安全特性

- ✅ API Key 安全存储在后端环境变量中
- ✅ 所有 AI 调用通过服务器端 API Routes 进行
- ✅ 客户端无法访问敏感的 API Key
- ✅ 符合生产环境安全标准

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件并添加你的 Gemini API Key：

```bash
GEMINI_API_KEY=your_actual_api_key_here
```

**重要提示：**
- `.env.local` 文件已经在 `.gitignore` 中，不会被提交到 Git 仓库
- 确保不要将 API Key 提交到版本控制系统
- 在生产环境部署时，在平台的环境变量配置中设置 `GEMINI_API_KEY`

### 3. 运行开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 📁 项目结构

```
Med-Triage/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # 对话 API (服务器端)
│   │   └── analyze/route.ts   # 分析 API (服务器端)
│   ├── layout.tsx             # 根布局
│   ├── page.tsx               # 主页面
│   └── globals.css            # 全局样式
├── components/
│   ├── DiagnosisPanel.tsx     # 诊断面板组件
│   └── SankeyChart.tsx        # Sankey 图表组件
├── types.ts                   # TypeScript 类型定义
├── .env.local                 # 环境变量 (不提交到 Git)
├── next.config.ts             # Next.js 配置
├── tailwind.config.ts         # Tailwind CSS 配置
└── package.json               # 项目依赖
```

## 🛡️ 安全架构

### API 调用流程

```
客户端 (浏览器)
    ↓
    发送用户消息
    ↓
Next.js API Routes (服务器端)
    ↓
    使用环境变量中的 API Key
    ↓
Google Gemini AI API
    ↓
    返回 AI 响应
    ↓
Next.js API Routes
    ↓
    返回给客户端
    ↓
客户端显示结果
```

### 关键安全点

1. **API Key 隔离**：API Key 存储在 `.env.local` 中，只在服务器端可访问
2. **API Routes**：所有 AI 调用都通过 Next.js API Routes (`/api/chat` 和 `/api/analyze`)
3. **客户端保护**：客户端代码无法直接访问 `process.env.GEMINI_API_KEY`
4. **版本控制**：`.env.local` 被 `.gitignore` 排除，不会泄漏到 Git

## 🌐 部署

### Vercel (推荐)

1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 在 [Vercel](https://vercel.com) 导入项目
3. 在项目设置中添加环境变量：
   - 变量名：`GEMINI_API_KEY`
   - 变量值：你的 Gemini API Key
4. 部署完成！

### 其他平台

在部署平台的环境变量配置中设置：
```
GEMINI_API_KEY=your_actual_api_key_here
```

## 📝 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **图表**: Recharts
- **图标**: Heroicons
- **AI**: Google Gemini API

## ⚠️ 免责声明

本工具仅用于演示和教育目的，不能替代专业医疗建议。在紧急情况下，请立即拨打急救电话。

## 📄 许可证

MIT License
