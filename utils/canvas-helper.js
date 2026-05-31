/**
 * Canvas 判决书海报绘制工具
 * 使用 WeChat Canvas 2D API
 */

const COLORS = {
  BG: '#FFF5E6',
  CARD_BG: '#FFFFFF',
  TITLE: '#FF8C00',
  SECTION_TITLE: '#CC6600',
  TEXT: '#333333',
  LIGHT_TEXT: '#999999',
  BORDER: '#FFD699',
  SHADOW: 'rgba(0,0,0,0.05)',
  VERDICT_BG: '#FFF0E0',
};

/**
 * 生成判决书海报
 * @param {Object} judgment - 判词对象 { caseReview, catJudgment, finalVerdict, punishment, whisper }
 * @returns {Promise<string>} 临时文件路径
 */
function generatePoster(judgment) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery();
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          reject(new Error('Canvas 节点未找到'));
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const W = 540;
        const H = 960;

        // 设置 Canvas 尺寸
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        // ----- 1. 背景 -----
        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, W, H);

        // ----- 2. 顶部装饰条 -----
        ctx.fillStyle = COLORS.TITLE;
        ctx.fillRect(0, 0, W, 8);
        ctx.fillStyle = COLORS.BORDER;
        ctx.fillRect(0, H - 8, W, 8);

        // ----- 3. 标题 -----
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = COLORS.TITLE;
        ctx.fillText('🐱 皮皮法官 · 判决书', W / 2, 30);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = COLORS.LIGHT_TEXT;
        ctx.fillText('—— 情侣吵架 · AI 在线评理 ——', W / 2, 72);

        // 分隔线
        ctx.strokeStyle = COLORS.BORDER;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(40, 105);
        ctx.lineTo(W - 40, 105);
        ctx.stroke();
        ctx.setLineDash([]);

        // ----- 4. 内容区域 -----
        let y = 130;

        // 4a. 案件回顾
        y = drawSection(ctx, '📋 案件回顾', judgment.caseReview, y, W);

        // 4b. 猫猫判词（摘要）
        y = drawSection(ctx, '⚖️ 猫猫判词', truncateText(judgment.catJudgment, 120), y, W);

        // 4c. 终审判决（高亮）
        y = drawVerdictCard(ctx, '🏆 终审判决', judgment.finalVerdict, y, W);

        // 4d. 惩罚措施
        y = drawSection(ctx, '🎯 惩罚措施', judgment.punishment, y, W);

        // 4e. 悄悄话
        y = drawWhisperSection(ctx, '💌 本庭的悄悄话', judgment.whisper, y, W);

        // ----- 5. 留白+间隔 -----
        if (y < 740) y = 740;

        // ----- 6. 分隔线 -----
        ctx.strokeStyle = COLORS.BORDER;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(40, y);
        ctx.lineTo(W - 40, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // ----- 7. 签名 -----
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.font = '16px sans-serif';
        ctx.fillStyle = COLORS.LIGHT_TEXT;
        ctx.fillText('—— 皮皮法官 按爪 🐾', W - 40, y + 15);

        // ----- 8. 底部引导 -----
        ctx.textAlign = 'center';
        ctx.font = '13px sans-serif';
        ctx.fillStyle = COLORS.LIGHT_TEXT;
        ctx.fillText('长按保存 · 扫码来评理喵', W / 2, H - 50);

        // ----- 9. 生成临时文件 -----
        wx.canvasToTempFilePath({
          canvas: canvas,
          x: 0,
          y: 0,
          width: W,
          height: H,
          destWidth: W * 2,
          destHeight: H * 2,
          fileType: 'png',
          quality: 1,
        }).then((res) => {
          resolve(res.tempFilePath);
        }).catch((err) => {
          reject(err);
        });
      });
  });
}

/**
 * 绘制一个普通段落区块
 */
function drawSection(ctx, title, text, startY, maxW) {
  const margin = 30;
  const contentW = maxW - margin * 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 标题
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = COLORS.SECTION_TITLE;
  ctx.fillText(title, margin, startY);

  let y = startY + 30;

  // 内容（自动换行）
  if (text) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = COLORS.TEXT;
    y = wrapText(ctx, text, margin, y, contentW, 22);
  }

  return y + 16; // 返回下一个区块的起始 y
}

/**
 * 绘制终审判决（高亮卡片样式）
 */
function drawVerdictCard(ctx, title, text, startY, maxW) {
  const margin = 30;
  const contentW = maxW - margin * 2;

  // 绘制背景卡片
  ctx.fillStyle = COLORS.VERDICT_BG;
  roundRect(ctx, margin - 5, startY - 5, contentW + 10, 80, 8);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = COLORS.SECTION_TITLE;
  ctx.fillText(title, margin, startY);

  let y = startY + 30;

  if (text) {
    // 终审判决内容用大字、加粗
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#D4380D';
    // 只显示第一行
    const firstLine = text.split('\n')[0] || text;
    y = wrapText(ctx, firstLine, margin, y, contentW, 28);
  }

  return startY + 90;
}

/**
 * 绘制悄悄话（特殊样式）
 */
function drawWhisperSection(ctx, title, text, startY, maxW) {
  const margin = 30;
  const contentW = maxW - margin * 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = COLORS.SECTION_TITLE;
  ctx.fillText(title, margin, startY);

  let y = startY + 26;

  if (text) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fontStyle = 'italic';
    y = wrapText(ctx, text, margin, y, contentW, 20);
  }

  return y + 12;
}

/**
 * 自动换行文本绘制
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\n') {
      ctx.fillText(line, x, y);
      line = '';
      y += lineHeight;
      continue;
    }
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
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

/**
 * 裁切文本到指定字符数
 */
function truncateText(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen) + '…';
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

module.exports = {
  generatePoster,
};
