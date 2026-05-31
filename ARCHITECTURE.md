# 《猫猫法官》MVP 极简技术架构

> 版本：v1.0 MVP | 路线：独立开发优先 | 目标：3 天可跑通核心闭环

---

## 一、核心闭环（MVP 唯一通路）

```
手动输入 → AI 判词 → Canvas 判决书海报 → 保存/分享
  (v1.1 加 OCR 截图输入)
```

**MVP 不做的事：**
- ❌ 不做 OCR（默认隐藏入口，v1.1 开启）
- ❌ 不做数据库（无历史记录、无登录、无存储）
- ❌ 不做 WebSocket 流式（云函数同步返回）
- ❌ 不做分享海报 + 小程序码（后续叠加，MVP 先用截图分享）

---

## 二、文件目录树

```
猫猫法官/
│
├── app.js                          # 全局入口：仅初始化云环境
├── app.json                        # 页面注册：仅 index / loading / result
├── app.wxss                        # 全局样式：CSS 变量 + 主题色
│
├── assets/                         # ── 静态资源 ──
│   ├── cat-judge.png               # 法官猫主形象（首页展示）
│   ├── cat-loading.png             # loading 页猫猫图
│   ├── cat-hammer.png              # 法槌图标
│   └── cat-paw.svg                 # 猫爪装饰元素
│
├── pages/                          # ── 3 个页面 ──
│   ├── index/                      # [首页] 纠纷输入页
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   │
│   ├── loading/                    # [加载页] AI 审理过渡动画
│   │   ├── loading.js
│   │   ├── loading.wxml
│   │   ├── loading.wxss
│   │   └── loading.json
│   │
│   └── result/                     # [结果页] 判决展示 + Canvas 海报
│       ├── result.js
│       ├── result.wxml
│       ├── result.wxss
│       └── result.json
│
├── utils/                          # ── 工具函数 ──
│   ├── util.js                     # 通用工具（已有，可追加）
│   ├── constants.js                # 常量：云环境 ID、DeepSeek 配置等
│   └── canvas-helper.js            # Canvas 海报绘制工具
│
├── styles/                         # ── 样式 ──
│   ├── variables.wxss              # 主题色 CSS 变量
│   └── animations.wxss             # 全局动画（loading 旋转等）
│
├── cloud-functions/                # ── 仅 1 个云函数 ──
│   └── evaluateCase/               # 合并 OCR + AI 调用
│       ├── index.js                # 入口：接收文本 → 调 DeepSeek → 返回判词
│       └── package.json            # 依赖：openai SDK
│
├── cloudbaserc.json                # 云开发配置文件
│
└── PROJECT.md                      # 开发文档（本文件）
```

---

## 三、3 个页面功能详述

### 3.1 首页 `pages/index` — 纠纷输入

```
┌────────────────────────┐
│   🐱 皮皮法官  ← 导航栏  │
│                        │
│   ┌────────────────┐   │
│   │                │   │
│   │   (猫猫法官图)   │   │  ← 法官猫形象（增强代入感）
│   │                │   │
│   └────────────────┘   │
│                        │
│   ┌────────────────┐   │
│   │ 描述你们的争吵…   │   │  ← textarea 输入框
│   │                  │   │     placeholder 示例：
│   │                  │   │     "她因为我忘了纪念日生气了..."
│   │                  │   │
│   └────────────────┘   │
│                        │
│   [📷 上传截图] (v1.1) │  ← OCR 入口，默认灰色禁用文案
│                        │
│   [ ⚖️ 提交审理 ]      │  ← 提交按钮
│                        │     空内容禁用
└────────────────────────┘
```

**逻辑：**
1. 用户输入争吵内容到 textarea
2. 点击「提交审理」→ 校验非空
3. 携带 `{ text }` → `wx.navigateTo({ url: '/pages/loading/loading?text=xxx' })`
4. OCR 按钮默认展示文字："📷 截图吵架（v1.1 敬请期待）"，灰色不可点击

### 3.2 加载页 `pages/loading` — AI 审理中

```
┌────────────────────────┐
│                        │
│       🐱               │  ← 猫猫图像旋转动画（CSS animation）
│    (旋转动画)           │
│                        │
│   "猫猫正在翻阅法典…"   │  ← 状态文案（3 条轮播）
│                        │     每 3 秒切换：
│   ━━━━━━━━░░░░  70%   │     1. "猫猫正在翻阅法典…"
│                        │     2. "法槌已经举起来了…"
│   [ 取消审理 ]          │     3. "判决快要出炉了…"
│                        │
└────────────────────────┘
```

**逻辑：**
1. `onLoad` 时从 options 获取 text
2. 调用 `wx.cloud.callFunction({ name: 'evaluateCase', data: { text } })`
3. 启动进度条动画（模拟进度，非真实）
4. 成功 → `wx.redirectTo({ url: '/pages/result/result?data=' + encodeURIComponent(JSON.stringify(res)) })`
5. 失败 → 显示错误提示 + 重试按钮
6. 取消 → `wx.navigateBack()` 返回首页

### 3.3 结果页 `pages/result` — 判决展示 + Canvas 海报

```
┌────────────────────────┐
│  ← 返回   判决书        │  ← 导航栏：返回首页
│                        │
│  ┌────────────────┐    │
│  │ 🏷️ 【案件回顾】  │    │  ← 分段展示判词
│  │ 内容…           │    │     每个 section 独立卡片
│  └────────────────┘    │
│                        │
│  ┌────────────────┐    │
│  │ 🏷️ 【猫猫判词】  │    │
│  │ 内容…           │    │
│  └────────────────┘    │
│                        │
│  ┌────────────────┐    │
│  │ 🏆 【终审判决】  │    │  ← 带高亮/特效
│  │ 原告胜诉！      │    │
│  └────────────────┘    │
│                        │
│  ┌────────────────┐    │
│  │ 🎯 【惩罚措施】  │    │  ← 趣味展示
│  │ 罚洗碗一周！    │    │
│  └────────────────┘    │
│                        │
│  ┌────────────────┐    │
│  │ 💌 【悄悄话】   │    │  ← 温馨收尾
│  │ 内容…           │    │
│  └────────────────┘    │
│                        │
│  ——— 皮皮法官 按爪 🐾  │  ← 签名
│                        │
│  ┌──────┐ ┌──────┐    │
│  │ 生成  │ │ 重新  │    │  ← 底部按钮组
│  │ 海报  │ │ 审理  │    │
│  └──────┘ └──────┘    │
└────────────────────────┘
```

**逻辑：**
1. `onLoad` 时解析云函数返回的 JSON 判词
2. 分段渲染到 5 个卡片区域
3. 点击「生成海报」→ `canvas-helper.js` 绘制判决书海报（带猫猫元素）
4. 海报绘制完成后 → 弹窗预览 → 可保存到相册 / 转发给好友
5. 点击「重新审理」→ `wx.redirectTo({ url: '/pages/index/index' })` 回到首页

---

## 四、后端：唯一云函数 `evaluateCase`

### 4.1 函数概要

| 项目 | 内容 |
|------|------|
| 函数名 | `evaluateCase` |
| 超时 | 60 秒（DeepSeek 响应通常 5-15s） |
| 入参 | `{ text: string, ocrFileID?: string }` |
| 出参 | `{ code: 0, data: { judgment: {...} }, error?: string }` |
| 依赖 | `openai`（DeepSeek 兼容 OpenAI 协议）|
| 密钥 | 通过云函数环境变量注入 `DEEPSEEK_API_KEY` |

### 4.2 核心流程

```
evaluateCase({ text, ocrFileID? })
    │
    ├─ 如有 ocrFileID ──→ 调用云调用 OCR（v1.1 启用）
    │                       cloud.openapi.ocr.printedText({ imgUrl: fileID })
    │                       → 合并 OCR 文本
    │
    ├─ 组装 messages
    │   [
    │     { role: 'system', content: SYSTEM_PROMPT },
    │     { role: 'user', content: text }
    │   ]
    │
    ├─ 调 DeepSeek API (非流式)
    │   POST https://api.deepseek.com/v1/chat/completions
    │   {
    │     model: 'deepseek-chat',
    │     messages: [...],
    │     temperature: 0.8,
    │     max_tokens: 1500
    │   }
    │
    ├─ 解析返回值
    │   提取 assistant 的回复内容
    │
    ├─ 结构化解析（正则提取 5 个板块）
    │   judgment = {
    │     caseReview: '...',     // 【案件回顾】内容
    │     catJudgment: '...',    // 【猫猫判词】内容
    │     finalVerdict: '...',   // 【终审判决】内容
    │     punishment: '...',     // 【惩罚措施】内容
    │     whisper: '...'         // 【🐱 本庭的悄悄话】内容
    │   }
    │
    └─ return { code: 0, data: { judgment } }
```

### 4.3 index.js 核心代码骨架

```javascript
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const OpenAI = require('openai');

// 从环境变量读取 DeepSeek 配置
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// System Prompt（完整内容见 SYSTEM_PROMPT.md）
const SYSTEM_PROMPT = `（略，原文完整嵌入）`;

exports.main = async (event, context) => {
  const { text, ocrFileID } = event;

  // [v1.1] 如果包含 ocrFileID，先做 OCR
  let inputText = text;
  if (ocrFileID) {
    try {
      const ocrResult = await cloud.openapi.ocr.printedText({
        imgUrl: ocrFileID
      });
      // 提取 OCR 文本
      const ocrText = ocrResult.items.map(item => item.text).join('\n');
      inputText = text ? `${text}\n\n--- 聊天截图 ---\n${ocrText}` : ocrText;
    } catch (err) {
      console.error('OCR failed:', err);
      // OCR 失败不阻断流程，使用原始 text
    }
  }

  // 调用 DeepSeek
  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: inputText }
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });

  const rawContent = completion.choices[0].message.content;

  // 结构化解析 5 个板块
  const judgment = parseJudgment(rawContent);

  return {
    code: 0,
    data: { judgment }
  };
};

function parseJudgment(content) {
  const sections = {};
  const patterns = [
    { key: 'caseReview', regex: /【案件回顾】([\s\S]*?)(?=【猫猫判词】|$)/ },
    { key: 'catJudgment', regex: /【猫猫判词】([\s\S]*?)(?=【终审判决】|$)/ },
    { key: 'finalVerdict', regex: /【终审判决】([\s\S]*?)(?=【惩罚措施】|$)/ },
    { key: 'punishment', regex: /【惩罚措施】([\s\S]*?)(?=【🐱?\s*本庭的悄悄话】|$)/ },
    { key: 'whisper', regex: /【🐱?\s*本庭的悄悄话】([\s\S]*?)(?=$)/ },
  ];

  for (const { key, regex } of patterns) {
    const match = content.match(regex);
    sections[key] = match ? match[1].trim() : '';
  }

  return sections;
}
```

### 4.4 package.json

```json
{
  "name": "evaluateCase",
  "version": "1.0.0",
  "dependencies": {
    "wx-server-sdk": "latest",
    "openai": "^4.0.0"
  }
}
```

### 4.5 云函数环境变量

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DEEPSEEK_API_KEY` | `sk-xxxxxxxx` | DeepSeek API 密钥 |
| `TZ` | `Asia/Shanghai` | 时区 |

---

## 五、Canvas 海报设计

### 5.1 海报规格

| 项 | 值 |
|----|-----|
| 尺寸 | 540 × 960 px（3:4 竖版，适合手机分享）|
| 背景色 | 暖白 #FFF5E6 |
| 边框 | 橙色描边 + 猫爪装饰 |
| 字体 | 系统默认（PingFang SC / 思源黑体）|

### 5.2 海报布局

```
┌────────────────────────────┐
│  🐱 皮皮法官 · 判决书       │  ← 标题区，橙色字
│                            │
│  ──────────────────────    │
│                            │
│  【案件回顾】               │
│  用户输入的争吵摘要…        │
│                            │
│  【终审判决】               │
│  🏆 原告胜诉！             │  ← 放大，橙色底纹
│                            │
│  【惩罚措施】               │
│  罚洗碗一周！              │  ← 带趣味 icon
│                            │
│  💌 悄悄话…                │
│                            │
│  ──────────────────────    │
│  长按保存 · 扫码也来评理   │  ← 底部引导文案
│  [ 小程序码占位 ]          │
└────────────────────────────┘
```

### 5.3 Canvas 绘制核心逻辑（`canvas-helper.js`）

```javascript
async function generatePoster(judgment) {
  const ctx = wx.createCanvasContext('posterCanvas');
  const w = 540, h = 960;

  // 1. 背景
  ctx.setFillStyle('#FFF5E6');
  ctx.fillRect(0, 0, w, h);

  // 2. 标题
  ctx.setFillStyle('#FF8C00');
  ctx.setFontSize(28);
  ctx.setTextAlign('center');
  ctx.fillText('🐱 皮皮法官 · 判决书', w / 2, 60);

  // 3. 分隔线
  ctx.setStrokeStyle('#FFD699');
  ctx.beginPath();
  ctx.moveTo(30, 85);
  ctx.lineTo(w - 30, 85);
  ctx.stroke();

  // 4. 各板块内容（自动换行文本）
  const sections = [
    { title: '【案件回顾】', text: judgment.caseReview, y: 120 },
    { title: '【终审判决】', text: judgment.finalVerdict, y: 350 },
    { title: '【惩罚措施】', text: judgment.punishment, y: 500 },
    { title: '', text: judgment.whisper, y: 650 },
  ];

  for (const s of sections) {
    if (s.title) {
      ctx.setFontSize(18);
      ctx.setFillStyle('#CC6600');
      ctx.fillText(s.title, 40, s.y);
    }
    ctx.setFontSize(15);
    ctx.setFillStyle('#333333');
    // wrapText 处理自动换行
    wrapText(ctx, s.text, 40, s.y + (s.title ? 25 : 0), w - 80, 22);
  }

  // 5. 底部签名
  ctx.setFontSize(16);
  ctx.setFillStyle('#999999');
  ctx.setTextAlign('right');
  ctx.fillText('—— 皮皮法官 按爪 🐾', w - 40, h - 100);

  ctx.draw();
  return { w, h };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (const char of text) {
    const testLine = line + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
```

---

## 六、数据流全景

```
用户输入 "她忘了纪念日…"
    │
    ▼
wx.navigateTo(/pages/loading?text=...)
    │
    ▼
wx.cloud.callFunction('evaluateCase', { text })
    │
    ├─ 云函数内：调 DeepSeek API ──→ 返回判词 JSON
    │
    ▼
success → wx.redirectTo(/pages/result?data=...)
    │
    ▼
渲染 5 个判词板块
    │
    ├─ [生成海报] → Canvas 绘制 → 保存/分享
    └─ [重新审理] → wx.redirectTo(/pages/index)
```

---

## 七、异常处理（MVP 最小集）

| 场景 | 表现 | 处理 |
|------|------|------|
| 输入为空 | 按钮置灰 | 提示"说点什么喵" |
| 云函数超时 | 加载页超过 25s | 弹窗"猫猫睡着了…" + 重试/返回 |
| DeepSeek 返回异常 | 云函数返回 error | 加载页弹错误提示 + 返回首页 |
| 解析判词失败 | 某个板块为空 | 展示"本法庭今天舌头打结了喵"兜底文案 |
| 网络断开 | callFunction 失败 | `wx.showToast` + 返回首页 |

---

## 八、cloudbaserc.json 配置

```json
{
  "envId": "你的云环境ID",
  "functionRoot": "cloud-functions",
  "functions": [
    {
      "name": "evaluateCase",
      "timeout": 60,
      "envVariables": {
        "DEEPSEEK_API_KEY": "sk-你的密钥",
        "TZ": "Asia/Shanghai"
      }
    }
  ]
}
```

---

## 九、开发路线（MVP → v1.1）

```
Day 1 ── 云函数：evaluateCase 对接 DeepSeek + 结构化解析
Day 2 ── 前端：index（输入） + loading（加载） + result（展示）
Day 3 ── Canvas 海报绘制 + 联调跑通完整闭环
        ─── MVP 发布 ───
Day 4+ ── v1.1：OCR 截图输入（开启云调用 OCR + 图片上传）
        ── v1.2：历史记录（云数据库 + 列表页）
        ── v1.3：分享海报 + 小程序码
```

---

*版本：v1.0 MVP | 最后更新：2026-05-13*
