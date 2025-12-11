# 部署指南

## 本地开发

### 前置要求
- Node.js 18+ 
- npm 或 yarn

### 步骤

1. **克隆并进入项目目录**
```bash
cd Med-Triage
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**

复制 `.env.local.example` 为 `.env.local`：
```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 并添加你的 Gemini API Key：
```env
GEMINI_API_KEY=你的实际API_KEY
```

获取 API Key：https://aistudio.google.com/app/apikey

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**

打开浏览器访问：http://localhost:3000

---

## 生产部署

### Vercel 部署（推荐）

Vercel 是 Next.js 的官方部署平台，部署最简单。

#### 步骤：

1. **注册 Vercel 账号**
   - 访问 https://vercel.com
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **连接 Git 仓库**
   - 将代码推送到 Git 仓库
   - 在 Vercel 中点击 "New Project"
   - 选择你的仓库

3. **配置环境变量**
   - 在项目设置 → Environment Variables
   - 添加：
     - Name: `GEMINI_API_KEY`
     - Value: 你的 Gemini API Key
     - Environment: Production (也可选择 Preview 和 Development)

4. **部署**
   - 点击 "Deploy"
   - 等待构建完成
   - 访问分配的域名

#### 自动部署
每次推送到 Git 仓库，Vercel 会自动重新部署。

---

### Netlify 部署

1. **注册 Netlify 账号**
   - 访问 https://netlify.com

2. **连接仓库**
   - 点击 "Add new site" → "Import an existing project"
   - 选择你的 Git 仓库

3. **构建设置**
   - Build command: `npm run build`
   - Publish directory: `.next`

4. **环境变量**
   - Site configuration → Environment variables
   - 添加 `GEMINI_API_KEY`

5. **部署**
   - 点击 "Deploy site"

---

### Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine AS base

# 依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 运行阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

在 `next.config.ts` 中添加：
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
};
```

构建和运行：
```bash
docker build -t med-triage .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key med-triage
```

---

### 云平台部署

#### AWS (Amplify/EC2/ECS)
1. 推送代码到 Git
2. 在 AWS Amplify 连接仓库
3. 配置环境变量
4. 自动部署

#### Google Cloud Run
```bash
# 构建 Docker 镜像
gcloud builds submit --tag gcr.io/PROJECT_ID/med-triage

# 部署
gcloud run deploy med-triage \
  --image gcr.io/PROJECT_ID/med-triage \
  --platform managed \
  --set-env-vars GEMINI_API_KEY=your_key
```

#### Azure Static Web Apps
1. 连接 GitHub 仓库
2. 配置构建
3. 添加环境变量
4. 部署

---

## 环境变量管理

### 重要提示

⚠️ **永远不要将 API Key 提交到代码仓库！**

✅ **正确的做法：**
- 使用 `.env.local` 存储本地开发的密钥
- `.env.local` 已在 `.gitignore` 中
- 在部署平台的界面中配置生产环境的密钥

### 检查清单

- [ ] `.env.local` 不在 Git 仓库中
- [ ] `.gitignore` 包含 `.env*.local` 和 `.env`
- [ ] 生产环境在平台界面配置了 `GEMINI_API_KEY`
- [ ] 示例文件 `.env.local.example` 不包含真实密钥

---

## 性能优化

### 生产构建优化

```bash
npm run build
npm start
```

### 图片优化
使用 Next.js 的 `<Image>` 组件自动优化图片。

### 代码分割
Next.js 自动进行代码分割，按路由懒加载。

### 缓存
API Routes 可以添加缓存头：
```typescript
export async function GET() {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
```

---

## 监控和日志

### Vercel Analytics
在 Vercel 部署后自动启用。

### 自定义监控
可以集成：
- Sentry（错误追踪）
- LogRocket（用户会话记录）
- Google Analytics

---

## 故障排除

### 常见问题

**1. API 调用失败**
- 检查 `GEMINI_API_KEY` 是否正确配置
- 查看服务器日志

**2. 构建失败**
- 检查 Node.js 版本
- 清理缓存：`rm -rf .next node_modules && npm install`

**3. 样式问题**
- 确保 Tailwind CSS 配置正确
- 检查 `tailwind.config.ts` 和 `postcss.config.js`

---

## 技术支持

如有问题，请查看：
- [Next.js 文档](https://nextjs.org/docs)
- [Vercel 部署文档](https://vercel.com/docs)
- [项目 Issues](https://github.com/your-repo/issues)
