/**
 * Loading 页 - AI 审理中
 *
 * 功能：
 *   1. 展示猫猫思考动画和轮播状态文案
 *   2. 调用 evaluateCase 云函数（回调式，最兼容）
 *   3. 支持前端测试模式（_test=true 跳过云函数）
 *   4. 失败时区分错误类型显示不同提示 + 有限次重试
 */

const STATUS_TEXTS_SINGLE = [
  '猫猫正在翻阅法典…',
  '法槌已经举起来了…',
  '判决快要出炉了…',
  '猫猫尾巴都写酸了…',
];

const STATUS_TEXTS_IMAGE = [
  '猫猫正在查看聊天截图…',
  '正在识别截图里的文字喵',
  '正在结合文字和截图分析…',
  '法槌已经举起来了…',
];

const STATUS_TEXTS_DUAL = [
  '猫猫正在对比两边的说法…',
  '天平两端都要称一称喵…',
  '兼听则明，猫猫正在思考…',
  '判决快要出炉了…',
];

const PHASES = [
  { progress: 15, text: '正在连接 AI 法官…' },
  { progress: 35, text: '猫猫正在认真审理…' },
  { progress: 55, text: '爪爪正在敲击判决书…' },
  { progress: 75, text: '判决快要出炉了…' },
  { progress: 90, text: '最后润色中…' },
  { progress: 100, text: '判决完成！' },
];

const DECORATIVE_LINES = [
  '📖 正在查阅《情侣吵架判例大全》',
  '⚖️ 天平两端都放上了猫罐头',
  '🐾 爪爪正在敲击判决书',
  '💭 猫猫陷入了沉思…',
];

// 模拟判词（单方模式）
const MOCK_JUDGMENT = {
  caseReview: '以皮皮法官的名义宣判——本案源于一段情侣日常争执。A 方因 B 方忘记纪念日而不悦，B 方则以工作繁忙为由辩解。双方各执一词，属典型的「需要被在乎」vs「真的很疲惫」型矛盾。',
  catJudgment: 'A 方的问题：情绪表达过于隐晦，"你猜我为什么生气"是本法庭最不推荐的沟通方式喵，这属于典型的"喵身攻击"——用沉默惩罚对方。\nB 方的问题：道歉之后没有补救措施，光说"我错了"不够，要给解决方案才对，本法庭建议启动"爪护条款"：事后主动规划补偿方案。\n本法庭抓重点：你们不是在争纪念日本身，是在争"你有没有把我的感受放在心上"。',
  finalVerdict: '以皮皮法官的名义宣判——双方各打五十大板！一个没好好说，一个没好好哄。',
  punishment: '罚 A 方：下次纪念日提前一周提醒，并策划一个小惊喜。\n罚 B 方：今晚负责做一顿饭（或者点对方爱吃的外卖），全程不准看手机。',
  whisper: '纪念日本来就是提醒你们相爱的日子，不是用来吵架的。现在去抱一下对方——本法庭批准了，不用写申请喵。🐾',
  responsibility: { aPercent: 45, bPercent: 55 },
};

// 模拟判词（双方陈述模式）
const MOCK_JUDGMENT_DUAL = {
  caseReview: '以皮皮法官的名义宣判——本案为双方陈述模式。A 方认为自己在关系中付出更多却得不到对等回应，B 方则认为 A 方要求过高且沟通方式伤人。双方各执一词，属于典型的「付出感不对等」型矛盾。',
  catJudgment: 'A 方的问题：A 方习惯用抱怨来表达爱，但这种方式容易让对方产生防御心理，越说越僵喵，建议启动"爪护条款"：用"我需要"代替"你总是"。\nB 方的问题：B 方倾向于回避冲突，不表达真实感受反而让误会越积越深，这属于冷处理式"喵身攻击"。\n本法庭抓重点：A 方要的是被看见，B 方要的是被理解——两种需求并不冲突，但你们都在用对方听不懂的方式表达。',
  finalVerdict: '以皮皮法官的名义宣判——双方各自担责！一个不会好好说，一个不会好好听。',
  punishment: '罚 A 方：每天说一句具体感谢的话，不说抱怨，坚持三天。\n罚 B 方：每天主动问一次对方"你今天需要什么"，坚持三天。',
  whisper: '你们不是敌人，是队友。本法庭建议你们交换手机写一段"对方视角"的事发经过——看完再吵，效果更佳喵。🐾',
  responsibility: { aPercent: 50, bPercent: 50 },
};

Page({
  data: {
    statusText: STATUS_TEXTS_SINGLE[0],
    progress: 0,
    progressText: '准备中…',
    decorativeLines: DECORATIVE_LINES,
    currentDeco: 0,
  },

  // 实例变量
  text: '',
  mode: 'single', // 'single' | 'dual'
  imageFileIDs: [], // 截图 fileID 数组
  cancelled: false,
  retryCount: 0,
  maxRetries: 2,
  phaseIndex: 0,
  statusTimer: null,
  progressTimer: null,
  decoTimer: null,
  timeoutId: null,

  // ── 生命周期 ──
  onLoad(options) {
    try {
      this.text = decodeURIComponent(options.text || '');
    } catch (e) {
      this.text = options.text || '';
    }
    this.mode = options.mode === 'dual' ? 'dual' : 'single';

    // 解析截图参数（逗号分隔的多个 fileID）
    const imagesRaw = options.images || '';
    if (imagesRaw) {
      try {
        this.imageFileIDs = decodeURIComponent(imagesRaw).split(',').filter(id => id.trim());
      } catch (e) {
        this.imageFileIDs = imagesRaw.split(',').filter(id => id.trim());
      }
    }
    const hasImages = this.imageFileIDs.length > 0;

    // 根据模式选择状态文案
    let statusTexts;
    if (hasImages) {
      statusTexts = STATUS_TEXTS_IMAGE;
    } else {
      statusTexts = this.mode === 'dual' ? STATUS_TEXTS_DUAL : STATUS_TEXTS_SINGLE;
    }
    this.setData({ statusText: statusTexts[0] });

    // 前端测试模式：跳过云函数，直接返回模拟数据
    if (options._test === 'true') {
      console.log('[Loading] 🧪 测试模式启动，跳过云函数, mode:', this.mode);
      this.startTimers();
      setTimeout(() => {
        this.updatePhase(5);
        this.stopTimers();
        setTimeout(() => {
          if (this.cancelled) return;
          const mockData = this.mode === 'dual' ? MOCK_JUDGMENT_DUAL : MOCK_JUDGMENT;
          const encoded = encodeURIComponent(JSON.stringify(mockData));
          wx.redirectTo({ url: `/pages/result/result?data=${encoded}&mode=${this.mode}` });
        }, 500);
      }, 2000);
      return;
    }

    if (!this.text.trim() && !hasImages) {
      wx.showToast({ title: '没有输入内容喵', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.startTimers();
    this.callAI();
  },

  onUnload() {
    this.cleanup();
  },

  // ── 核心：调用云函数（回调式，最稳定） ──
  callAI() {
    if (this.cancelled) return;

    const that = this;
    this.updatePhase(0);

    console.log('========== [Loading] 云函数调用 ==========');
    console.log('[Loading] 文本长度:', this.text.length);
    console.log('[Loading] 云函数名: evaluateCase');
    console.log('[Loading] 环境 ID(全局):', getApp().globalData.cloudEnv);
    console.log('========================================');

    const hasImages = this.imageFileIDs.length > 0;

    // 根据是否有图片选择超时时间（含图片需要更多时间）
    const TIMEOUT_MS = hasImages ? 30000 : 25000;
    this.timeoutId = setTimeout(() => {
      if (that.cancelled) return;
      console.error('[Loading] ⏰ 超时！', TIMEOUT_MS / 1000, '秒内云函数无响应');
      that.handleError(
        `❌ 审理超时\n\n云函数超过 ${TIMEOUT_MS / 1000} 秒未响应。\n\n` +
        '可能原因：\n' +
        '1⃣ 云函数未上传：右键 evaluateCase → 上传并部署\n' +
        '2⃣ 云环境未关联：云开发控制台 → 设置 确认已关联本小程序\n' +
        '3⃣ wx.cloud.init 失败：在 app.js 检查是否有报错\n' +
        '4⃣ 网络问题：请在真机上测试，模拟器可能有限制'
      );
    }, TIMEOUT_MS);

    // 构建云函数参数
    const callData = { text: this.text, mode: this.mode };
    if (hasImages) {
      callData.imageFileIDs = this.imageFileIDs;
    }

    // 正式调用云函数（显式传入环境 ID）
    console.log('[Loading] ▶ 正在调用 wx.cloud.callFunction...');
    console.log('[Loading] 参数:', JSON.stringify(callData));
    wx.cloud.callFunction({
      name: 'evaluateCase',
      data: callData,
      config: {
        env: 'cloud1-d1gpjzw7z936ec761', // 显式指定环境，避免 init 传播问题
      },
      success(res) {
        clearTimeout(that.timeoutId);
        if (that.cancelled) return;

        console.log('[Loading] ✅ callFunction 成功');
        console.log('[Loading] res.result:', JSON.stringify(res.result).slice(0, 300));

        const result = res.result || {};

        if (result.code === 0 && result.data && result.data.judgment) {
          console.log('[Loading] ✅ 业务成功，跳转结果页');
          that.updatePhase(5);
          that.stopTimers();

          setTimeout(() => {
            if (that.cancelled) return;
            const encoded = encodeURIComponent(JSON.stringify(result.data.judgment));
            const mode = result.data.mode || that.mode || 'single';
            wx.redirectTo({ url: `/pages/result/result?data=${encoded}&mode=${mode}` });
          }, 500);
        } else {
          console.warn('[Loading] ❌ 业务错误:', result.error || '未知');
          that.handleError(result.error || '审理失败了喵');
        }
      },
      fail(err) {
        clearTimeout(that.timeoutId);
        if (that.cancelled) return;

        console.error('========== [Loading] 调用失败 ==========');
        console.error('[Loading] errCode:', err.errCode);
        console.error('[Loading] errMsg:', err.errMsg);
        console.error('[Loading] 完整错误对象:', JSON.stringify(err));
        console.error('========================================');

        // 错误关键词映射
        const msg = (err.errMsg || err.message || '').toLowerCase();
        let userMsg;

        if (msg.includes('notinit') || msg.includes('not init')) {
          userMsg = '❌ 云开发未初始化\n\napp.js 中的 wx.cloud.init() 可能未正确执行，请在 Console 检查 [App] 相关日志';
        } else if (msg.includes('functionnotexists') || msg.includes('not found')) {
          userMsg = '❌ 云函数未上传\n\n右键 evaluateCase → 上传并部署：云端安装依赖';
        } else if (msg.includes('env') || msg.includes('environment')) {
          userMsg = '❌ 云环境错误\n\n请确认云开发控制台中 cloud1-d1gpjzw7z936ec761 这个环境存在且已关联本小程序';
        } else if (msg.includes('request:fail')) {
          userMsg = '❌ 网络请求失败\n\n请在真机上测试，或检查网络是否正常';
        } else if (msg.includes('timeout')) {
          userMsg = '❌ 请求超时\n\n请稍后重试喵';
        } else {
          userMsg = `❌ 调用失败\n\n${err.errMsg || '请检查云函数配置'}`;
        }

        that.handleError(userMsg);
      },
    });
    console.log('[Loading] ◀ callFunction 已发出，等待返回…');
  },

  // ── 错误处理 ──
  handleError(msg) {
    this.stopTimers();

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      wx.showModal({
        title: '喵…出错了',
        content: msg,
        confirmText: `再试一次 (${this.retryCount}/${this.maxRetries})`,
        cancelText: '返回首页',
        success: (res) => {
          if (this.cancelled) return;
          if (res.confirm) {
            this.phaseIndex = 0;
            this.setData({ progress: 0, progressText: '准备中…', statusText: STATUS_TEXTS_SINGLE[0] });
            this.startTimers();
            this.callAI();
          } else {
            wx.navigateBack();
          }
        },
      });
    } else {
      wx.showModal({
        title: '😿 多次尝试失败',
        content: `${msg}\n\n━━ 排查指南 ────\n① 云函数上传：右键 evaluateCase → 上传并部署\n② 云环境关联：云开发控制台 → 设置 → 确认已关联\n③ 查看日志：云开发控制台 → 云函数 → evaluateCase → 日志`,
        confirmText: '返回首页',
        cancelText: '再试一次',
        success: (res) => {
          if (this.cancelled) return;
          if (res.confirm) {
            wx.navigateBack();
          } else {
            this.retryCount = 0;
            this.phaseIndex = 0;
            this.setData({ progress: 0, progressText: '准备中…', statusText: STATUS_TEXTS_SINGLE[0] });
            this.startTimers();
            this.callAI();
          }
        },
      });
    }
  },

  // ── 进度控制 ──
  updatePhase(index) {
    const phase = PHASES[index];
    if (!phase) return;
    this.phaseIndex = index;
    if (phase.progress > this.data.progress || phase.progress === 100) {
      this.setData({ progress: phase.progress, progressText: phase.text });
    }
  },

  // ── 定时器 ──
  startTimers() {
    this.stopTimers();
    this.progressTimer = setInterval(() => {
      if (this.cancelled) return;
      const next = this.phaseIndex + 1;
      if (next < PHASES.length - 1) this.updatePhase(next);
    }, 3000);

    let statusTexts;
    if (this.imageFileIDs.length > 0) {
      statusTexts = STATUS_TEXTS_IMAGE;
    } else {
      statusTexts = this.mode === 'dual' ? STATUS_TEXTS_DUAL : STATUS_TEXTS_SINGLE;
    }
    let si = 0;
    this.statusTimer = setInterval(() => {
      si = (si + 1) % statusTexts.length;
      this.setData({ statusText: statusTexts[si] });
    }, 3000);

    let di = 0;
    this.decoTimer = setInterval(() => {
      di = (di + 1) % DECORATIVE_LINES.length;
      this.setData({ currentDeco: di });
    }, 4000);
  },

  stopTimers() {
    if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; }
    if (this.statusTimer) { clearInterval(this.statusTimer); this.statusTimer = null; }
    if (this.decoTimer) { clearInterval(this.decoTimer); this.decoTimer = null; }
  },

  cleanup() {
    this.cancelled = true;
    this.stopTimers();
    if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
  },

  // ── 用户操作 ──
  onCancel() {
    this.cleanup();
    wx.navigateBack();
  },
});
