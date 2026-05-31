# 🐱 皮皮法官 (Pipi Judge)

**AI 驱动的情侣吵架评理小程序 — 一只傲娇又公正的法官猫，帮你化解感情中的小矛盾**

> 一款基于微信小程序 + DeepSeek AI 的趣味互动工具。用户输入/截图吵架内容，AI 化身"皮皮法官"（一只傲娇法官猫）给出客观判词、责任比例、趣味惩罚和暖心悄悄话。

---

## ✨ 功能特色

- **⚖️ AI 智能判案** — 基于 DeepSeek API 的 LLM 推理，模拟法庭审判流程，给出客观公正的"判决书"
- **🐱 傲娇猫法官人设** — 精心设计的角色人格（System Prompt），判词兼具毒舌吐槽与温柔关怀
- **📊 责任比例** — 通过 AI 分析双方过错，以百分比形式量化责任分配
- **📸 截图 OCR** — 支持上传聊天截图，通过微信云开发 OCR 识别文字后分析（v1.1+）
- **🎨 海报生成** — Canvas 绘制判决书海报，可保存分享到朋友圈
- **🤖 双模式** — 单人描述 / 双方陈述两种输入模式
- **😄 趣味惩罚** — AI 根据争吵内容生成本性化的趣味"惩罚"方案

## 📱 截图预览

| 输入页 | 审理中 | 判决结果 |
|--------|--------|----------|
| 用户描述争吵内容 | AI 审理动画 | 结构化判词展示 |

## 🏗️ 技术架构

```
mini-program/                    # 微信小程序前端
├── pages/
│   ├── index/                   # 首页：纠纷输入（文本 + OCR v1.1）
│   ├── loading/                 # 加载页：AI 审理过渡动画
│   └── result/                  # 结果页：判决展示 + Canvas 海报
├── utils/
│   ├── constants.js             # 全局常量
│   ├── util.js                  # 工具函数
│   └── canvas-helper.js         # Canvas 海报绘制
├── styles/                      # 样式（CSS 变量 + 动画）
└── cloud-functions/
    └── evaluateCase/            # 云函数：OCR → DeepSeek API → 结构化解析
```

### 数据流

```
用户输入 → 云函数 evaluateCase → DeepSeek API → 结构化判词 → 前端展示 → Canvas 海报
    ↑                              ↓
  截图 OCR (v1.1)           【案件回顾】【责任比例】【猫猫判词】
                          【终审判决】【惩罚措施】【🐱悄悄话】
```

### 核心依赖

| 组件 | 技术 |
|------|------|
| 前端框架 | 微信小程序原生 |
| AI 引擎 | DeepSeek API（兼容 OpenAI 协议）|
| 图像识别 | 微信云开发 OCR |
| 后端 | 微信云函数（Node.js） |
| 海报 | Canvas 2D API |

## 🚀 快速开始

### 前置条件

- 微信开发者工具
- 微信云开发环境（已开通）
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/pipi-judge.git

# 2. 在微信开发者工具中打开项目
#    修改 project.config.json 中的 appid 为你的 AppID

# 3. 部署云函数
#    右键 cloud-functions/evaluateCase → 上传并部署

# 4. 配置云函数环境变量（在微信云开发控制台）
#    DEEPSEEK_API_KEY = sk-your-key-here

# 5. 修改 app.js 中的云环境 ID 为你的环境 ID
```

### 配置

所有需要自定义的配置项：

| 文件 | 配置项 | 说明 |
|------|--------|------|
| `app.js` | `CLOUD_ENV_ID` | 微信云开发环境 ID |
| `cloudbaserc.json` | `envId` / `DEEPSEEK_API_KEY` | 云环境 & API 密钥 |
| `project.config.json` | `appid` | 小程序 AppID |
| `utils/constants.js` | `CLOUD_ENV` / `DEEPSEEK.*` | 全局常量 |

## 📁 项目结构

```
pi pi-judge/
├── app.js                        # 入口：云环境初始化
├── app.json                      # 页面注册
├── app.wxss                      # 全局样式
├── cloudbaserc.json              # 云开发配置（示例，含占位符）
├── project.config.json           # 微信开发者工具配置
│
├── pages/
│   ├── index/                    # 首页：纠纷输入
│   ├── loading/                  # 加载页：AI 审理过渡
│   └── result/                   # 结果页：判词展示
│
├── cloud-functions/
│   └── evaluateCase/             # 唯一云函数
│       ├── index.js              # 核心逻辑（OCR + AI + 解析）
│       └── package.json          # 依赖
│
├── utils/
│   ├── constants.js              # 全局常量
│   ├── util.js                   # 通用工具
│   └── canvas-helper.js          # Canvas 海报
│
├── styles/
│   ├── variables.wxss            # 主题色 CSS 变量
│   └── animations.wxss           # 全局动画
│
├── images/                       # 静态图片资源
├── SYSTEM_PROMPT.md              # AI 角色提示词（完整版）
├── ARCHITECTURE.md               # 详细技术架构文档
└── README.md                     # 本文件
```

## 🧠 AI 系统提示词

皮皮法官的角色定义包含：

- **人设**：戴着迷你法袍领结的橘猫，表面嫌弃内心温柔
- **语气**：傲娇、毒舌但善意，必须使用"喵"、"本法庭"等标志性词汇
- **混搭风格**：正式法庭文书 + 可爱谐音梗（"爪护条款"、"喵身攻击"）
- **价值观红线**：禁止建议分手/暴力，不评判"爱不爱"，只评判具体行为

详见 [SYSTEM_PROMPT.md](./SYSTEM_PROMPT.md)

## 🗺️ 开发路线

| 版本 | 功能 | 状态 |
|------|------|------|
| v1.0 MVP | 文本输入 → AI 判词 → 海报生成 | ✅ 已完成 |
| v1.1 | 截图 OCR 输入 | ✅ 已完成 |
| v1.2 | 历史记录（云数据库）| 🔜 待开发 |
| v1.3 | 分享海报 + 小程序码 | 🔜 待开发 |
| v1.4 | 双人实时陈述模式 | 🔜 待开发 |

## 📄 许可证

[MIT](./LICENSE)

---

## 🙌 贡献

欢迎提交 Issue 和 PR！如果你想给皮皮法官增加新功能，请先开 Issue 讨论。

---

*Made with ❤️ and 🐱 — 用 AI 让恋爱少一点争吵，多一点温暖*
