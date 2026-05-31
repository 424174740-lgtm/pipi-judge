/**
 * 小程序全局常量
 * 注：云环境 ID 和 DeepSeek API Key 请替换为实际值
 */
const CONSTANTS = {
  // 云开发环境 ID（需替换）
  CLOUD_ENV: '你的云环境ID',

  // DeepSeek 配置（密钥通过云函数环境变量注入，此处仅做参考）
  DEEPSEEK: {
    BASE_URL: 'https://api.deepseek.com/v1',
    MODEL: 'deepseek-chat',
    MAX_TOKENS: 1500,
    TEMPERATURE: 0.8,
  },

  // OCR 特性开关（v1.1 开启）
  OCR_ENABLED: false,

  // 页面路由
  ROUTES: {
    INDEX: '/pages/index/index',
    LOADING: '/pages/loading/loading',
    RESULT: '/pages/result/result',
  },

  // 云函数名称
  CLOUD_FUNCTIONS: {
    EVALUATE_CASE: 'evaluateCase',
  },

  // 海报尺寸
  POSTER: {
    WIDTH: 540,
    HEIGHT: 960,
  },

  // 主题色
  COLORS: {
    PRIMARY: '#FF8C00',
    BG: '#FFF5E6',
    CARD_BG: '#FFFFFF',
    TEXT_DARK: '#333333',
    TEXT_LIGHT: '#999999',
    BORDER: '#FFD699',
    ACCENT: '#CC6600',
  },
};

module.exports = CONSTANTS;
