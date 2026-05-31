/**
 * 首页 - 纠纷输入页（支持单人/双方两种模式）
 *
 * v2.0 双方陈述模式重构：
 *   - 统一 onDualInput 处理器 + 动态按钮状态
 *   - 填写进度条 + 本地草稿自动保存/恢复
 *   - 字数分级预警
 */
Page({
  data: {
    // 单人模式
    text: '',
    // 截图上传（多模态）
    imageFileID: '',       // 上传后的云存储 fileID
    imageLocalPath: '',    // 本地临时路径（用于缩略图展示）
    imageUploading: false, // 是否正在上传
    imageAnalyzing: false, // 是否正在分析
    // 模式切换
    mode: 'single',
    // 双方陈述模式字段
    a_what: '',
    a_feel: '',
    b_what: '',
    b_feel: '',
    // 双方模式动态状态
    dualProgress: 0,
    dualProgressText: '填写 A 方必填信息即可提交',
    dualBtnText: '⚖️ 提交审理',
    dualCanSubmit: false,
    dualBtnDisabled: true,
  },

  // ── 生命周期 ──
  onLoad() {
    this.loadDualDraft();
    this.updateDualState();
  },

  onShow() {
    // 从草稿恢复（用户切后台回来可能丢了数据）
    const draft = wx.getStorageSync('pipi_dual_draft');
    if (draft) {
      const { a_what, a_feel, b_what, b_feel } = draft;
      // 只在当前字段为空时恢复，避免覆盖正在输入的内容
      const update = {};
      if (a_what && !this.data.a_what) update.a_what = a_what;
      if (a_feel && !this.data.a_feel) update.a_feel = a_feel;
      if (b_what && !this.data.b_what) update.b_what = b_what;
      if (b_feel && !this.data.b_feel) update.b_feel = b_feel;
      if (Object.keys(update).length > 0) {
        this.setData(update, () => this.updateDualState());
      }
    }
  },

  // ── 单人模式输入 ──
  onInput(e) {
    const val = e.detail.value;
    if (val.length >= 2000 && val.length > this.data.text.length) {
      wx.showToast({ title: '字数已达上限，请精简内容~', icon: 'none', duration: 2000 });
    }
    this.setData({ text: val });
  },

  // ── 上传聊天截图（存云存储，不 OCR，交由多模态 AI 分析） ──
  onPickImage() {
    if (this.data.imageUploading) return;

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        this.setData({ imageLocalPath: tempPath, imageUploading: true });

        // 上传到云存储
        const cloudPath = `chat-screenshots/${Date.now()}.png`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempPath,
          success: (uploadRes) => {
            this.setData({
              imageFileID: uploadRes.fileID,
              imageUploading: false,
            });
            wx.showToast({ title: '截图已上传，可提交审理', icon: 'success' });
          },
          fail: () => {
            this.setData({ imageUploading: false, imageLocalPath: '', imageFileID: '' });
            wx.showToast({ title: '上传截图失败了喵', icon: 'none' });
          },
        });
      },
    });
  },

  // ── 清除已上传的截图 ──
  onClearImage() {
    this.setData({
      imageFileID: '',
      imageLocalPath: '',
      imageUploading: false,
    });
  },

  // ── 双方模式统一输入处理器 ──
  onDualInput(e) {
    const field = e.currentTarget.dataset.field;
    const val = e.detail.value;
    const MAX = { a_what: 1000, a_feel: 1000, b_what: 1000, b_feel: 1000 };

    // 字数超限友好提示（仅首次到达上限时）
    if (val.length >= MAX[field] && val.length > (this.data[field] || '').length) {
      wx.showToast({ title: '字数已达上限，请精简内容~', icon: 'none', duration: 2000 });
    }

    const update = {};
    update[field] = val;
    this.setData(update, () => {
      this.updateDualState();
      this.saveDualDraft();
    });
  },

  // ── 双方模式状态计算 ──
  updateDualState() {
    const { a_what, a_feel, b_what, b_feel } = this.data;

    const af = a_what.trim(), af2 = a_feel.trim();
    const bf = b_what.trim(), bf2 = b_feel.trim();

    // 已填字段数
    let filled = 0;
    if (af) filled++;
    if (af2) filled++;
    if (bf) filled++;
    if (bf2) filled++;

    const aCoreOk = !!af && !!af2;    // A方核心（事情经过+感受）
    const aPartial = !!af;            // A方至少填了经过
    const bComplete = !!bf && !!bf2;  // B方完整

    const pct = Math.round((filled / 4) * 100);

    let btnText, progressText, canSubmit, disabled;

    if (filled === 0) {
      btnText = '⚖️ 请填写 A 方内容';
      progressText = '填写 A 方必填信息即可提交';
      canSubmit = false;
      disabled = true;
    } else if (aCoreOk && bComplete) {
      btnText = '⚖️ 双方已完备，提交审理！';
      progressText = `已填 ${filled}/4 · 全部完成，提交吧！`;
      canSubmit = true;
      disabled = false;
    } else if (aCoreOk) {
      btnText = '✅ A方已填，补充B方更公正 →';
      progressText = `A方完成 · 补充B方 ${filled - 2}/2`;
      canSubmit = true;
      disabled = false;
    } else if (aPartial) {
      btnText = '📝 继续填写，审理更准确';
      progressText = `A方 ${filled}/${Math.min(filled + 1, 4)} · 继续完善~`;
      canSubmit = true;
      disabled = false;
    } else {
      btnText = '⚖️ 提交审理';
      progressText = `已填 ${filled}/4 · 继续填写~`;
      canSubmit = false;
      disabled = true;
    }

    this.setData({
      dualProgress: pct,
      dualProgressText: progressText,
      dualBtnText: btnText,
      dualCanSubmit: canSubmit,
      dualBtnDisabled: disabled,
    });
  },

  // ── 草稿保存 / 恢复 ──
  saveDualDraft() {
    const { a_what, a_feel, b_what, b_feel } = this.data;
    wx.setStorageSync('pipi_dual_draft', { a_what, a_feel, b_what, b_feel });
  },

  loadDualDraft() {
    try {
      const draft = wx.getStorageSync('pipi_dual_draft');
      if (draft) {
        const update = {};
        if (draft.a_what) update.a_what = draft.a_what;
        if (draft.a_feel) update.a_feel = draft.a_feel;
        if (draft.b_what) update.b_what = draft.b_what;
        if (draft.b_feel) update.b_feel = draft.b_feel;
        if (Object.keys(update).length > 0) {
          this.setData(update);
        }
      }
    } catch (e) {
      console.warn('[Index] 草稿恢复失败:', e);
    }
  },

  clearDualDraft() {
    wx.removeStorageSync('pipi_dual_draft');
  },

  // ── 模式切换 ──
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== this.data.mode) {
      this.setData({ mode });
      if (mode === 'dual') this.updateDualState();
    }
  },

  // ── 提交 ──
  onSubmit() {
    if (this.data.mode === 'single') {
      const userText = this.data.text.trim();
      const imageFileID = this.data.imageFileID || '';

      if (!userText && !imageFileID) {
        wx.showToast({ title: '说点什么或传张截图喵…', icon: 'none' });
        return;
      }

      // 图片 fileID 传给 loading 页，由云函数多模态分析
      const extraParams = imageFileID ? `&images=${encodeURIComponent(imageFileID)}` : '';

      wx.navigateTo({
        url: `/pages/loading/loading?text=${encodeURIComponent(userText)}${extraParams}`,
      });
    } else {
      // 双方模式：至少 A 方经过必填
      const { a_what, a_feel, b_what, b_feel } = this.data;
      if (!a_what.trim()) {
        wx.showToast({ title: '至少说一下事情经过喵…', icon: 'none' });
        return;
      }
      const structuredText = `===== 双方陈述模式 =====\n\n【A方（我）的事情经过】\n${a_what.trim()}\n\n【A方（我）的感受】\n${(a_feel || '').trim()}\n\n【B方（对方）的事情经过】\n${(b_what || '').trim()}\n\n【B方（对方）的感受】\n${(b_feel || '').trim()}`;
      this.clearDualDraft();
      wx.navigateTo({
        url: `/pages/loading/loading?mode=dual&text=${encodeURIComponent(structuredText)}`,
      });
    }
  },
});
