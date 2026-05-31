/**
 * 结果页 - 判决展示 + Canvas 海报
 */
const { generatePoster } = require('../../utils/canvas-helper');

Page({
  data: {
    judgment: {
      caseReview: '',
      catJudgment: '',
      finalVerdict: '',
      punishment: '',
      whisper: '',
    },
    showPosterModal: false,
    posterTempPath: '',
    posterGenerating: false,
  },

  onLoad(options) {
    try {
      const dataStr = decodeURIComponent(options.data || '{}');
      const judgment = JSON.parse(dataStr);

      if (!judgment || Object.keys(judgment).length === 0) {
        throw new Error('empty judgment');
      }

      // 根据模式决定责任比例两侧的标签
      const mode = options.mode || 'single';
      const respSideLabelA = mode === 'dual' ? 'A 方' : '你方';
      const respSideLabelB = mode === 'dual' ? 'B 方' : '对方';

      this.setData({
        judgment,
        respSideLabelA,
        respSideLabelB,
      });
    } catch (err) {
      console.error('[Result] parse error:', err);
      wx.showToast({
        title: '判词解析失败了喵',
        icon: 'none',
        duration: 3000,
      });
    }
  },

  // ========== 海报生成 ==========
  async onGeneratePoster() {
    if (this.data.posterGenerating) return;

    this.setData({ posterGenerating: true });
    wx.showLoading({ title: '猫猫正在画海报…' });

    try {
      const tempPath = await generatePoster(this.data.judgment);
      this.setData({
        posterTempPath: tempPath,
        showPosterModal: true,
        posterGenerating: false,
      });
      wx.hideLoading();
    } catch (err) {
      console.error('[Poster Error]', err);
      wx.hideLoading();
      this.setData({ posterGenerating: false });
      wx.showToast({
        title: '海报生成失败了喵',
        icon: 'none',
        duration: 2000,
      });
    }
  },

  // ========== 保存到相册 ==========
  onSavePoster() {
    const tempPath = this.data.posterTempPath;
    if (!tempPath) return;

    wx.saveImageToPhotosAlbum({
      filePath: tempPath,
      success: () => {
        wx.showToast({ title: '已保存到相册喵', icon: 'success' });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny') || err.errMsg.includes('fail')) {
          // 没有授权，引导用户开启
          wx.showModal({
            title: '需要相册权限',
            content: '请允许保存图片到相册喵',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            },
          });
        } else {
          wx.showToast({ title: '保存失败喵', icon: 'none' });
        }
      },
    });
  },

  // ========== 转发给好友 ==========
  onSharePoster() {
    // 直接触发转发
    this.setData({ showPosterModal: false });

    // 需要用户手动操作，弹提示
    wx.showToast({
      title: '点击右上角「…」转发喵',
      icon: 'none',
      duration: 3000,
    });
  },

  // ========== 关闭弹窗 ==========
  onClosePoster() {
    this.setData({ showPosterModal: false });
  },

  onTapModalMask() {
    this.setData({ showPosterModal: false });
  },

  // ========== 重新审理 ==========
  onRetry() {
    wx.redirectTo({
      url: '/pages/index/index',
    });
  },

  // ========== 转发设置 ==========
  onShareAppMessage() {
    const { judgment } = this.data;
    const summary = judgment.finalVerdict
      ? `${judgment.finalVerdict} | ${judgment.punishment || ''}`
      : '来皮皮法官评评理喵！';

    return {
      title: summary.substring(0, 50),
      path: '/pages/index/index',
    };
  },

  // ========== 空操作（阻止弹窗关闭冒泡） ==========
  noop() {},
});
