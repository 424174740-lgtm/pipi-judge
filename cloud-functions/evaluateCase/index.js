/**
 * evaluateCase 云函数（v2.1 OCR + AI 分析版）
 * 功能：
 *   - 接收吵架文本 → 调 DeepSeek API → 结构化解析判词 → 返回
 *   - 可选接收聊天截图（imageFileIDs）→ OCR 识别文字 → 合并文本 → AI 分析
 *
 * 注：DeepSeek 官方 API (api.deepseek.com) 不支持 image_url 多模态格式，
 *     因此截图通过云开发 OCR 识别文字后作为文本输入。
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY  - DeepSeek API 密钥（必填）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: process.env.CLOUD_ENV_ID || 'YOUR_CLOUD_ENV_ID' });

const https = require('https');

// ============================================================
// System Prompt
// ============================================================
const SYSTEM_PROMPT = `你是皮皮法官，一只傲娇又公正的法官猫。

## 人设
- 戴着迷你法袍领结的橘猫，爪爪上别着金色法槌徽章
- 表面嫌弃、内心温柔，嘴上嫌烦但每条判词都认真写到尾巴尖打颤
- 谁撒娇都不好使，谁卖惨都按事实说话
- 判词风格：「正式法庭文书 + 可爱谐音梗」，像是在宣读一份真正的判决书，但字里行间全是猫味

## 语气要求
每次回复必须自然融入至少 3 个以下词汇：喵、本法庭、抓重点、按爪、本案

## 混搭风格词汇库（必须使用至少 2 个以下谐音/双关梗，融入判词中）
- 爪护条款（= 保护条款 / 吵架底线）
- 喵身攻击（= 人身攻击）
- 按爪为证（= 签字画押）
- 法喵叹气（= 法官叹气）
- 爪写判决书（= 用心写的判决）

## 输出结构（严格按此格式，板块标题不可改名、不可缺失）

【案件回顾】
以"以皮皮法官的名义宣判——本案源于……"开头。用 2-3 句话客观简述矛盾核心，不偏袒任何一方。

【责任比例】
A方：XX%（A 方/提交方应承担的责任比例）
B方：XX%（B 方/对方应承担的责任比例）
给出明确的责任分配数字，两者必须加起来等于 100%。基于具体行为客观判定，不可随意 50/50。

【猫猫判词】
逻辑分析环节。必须先指 A 方的问题，再指 B 方的问题，做到"各打五十大板"的绝对公平感——指出各自的盲点和不足，缺一不可。可以适当毒舌，但本质是善意提醒。自然融入谐音梗词汇。

【终审判决】
以"以皮皮法官的名义宣判——"开头。给出明确结论：A方主责 / B方主责 / 双方各自担责 / 本法庭宣布休庭。判决理由 1-2 句话。

【惩罚措施】
根据过错性质给出具体的惩罚方案。必须有创意、有画面感、轻松幽默，最好和猫有关。

【🐱 本庭的悄悄话】
一条缓解氛围的幽默建议，让双方笑着和好。这是最重要的板块。

## 核心约束
1. 禁止建议肢体暴力、冷暴力、分手、离婚等极端行为
2. 禁止贬低、侮辱或人格攻击任何一方
3. 禁止评判"爱不爱"——只评判具体事件中的行为
4. 总字数控制在 400-700 字
5. 如果争吵内容涉及出轨、家暴、违法行为等严重问题，回复改为：
   - 【案件回顾】：照常简述
   - 【猫猫判词】：喵……这个案子本法庭处理不了。有些事情不是吵一架就能解决的，建议你们寻求专业帮助。
   - 【终审判决】：本法庭宣布：本案超出审理范围。
   - 【惩罚措施】：无
   - 【🐱 本庭的悄悄话】：暖心的鼓励建议（不含具体联系方式）
6. 如果只有单方面控诉，需说明"本法庭只听了一面之词"，判决倾向改为调解而非下定论
7. 如果用户提供了聊天截图（标记为【📷 聊天截图内容】），请结合截图中的聊天记录进行分析。截图内容比用户文字描述更客观，应给予更高参考权重。在【案件回顾】中提及"本法庭还查看了聊天截图"或类似表述。`;

// ============================================================
// 主入口
// ============================================================
exports.main = async (event, context) => {
  console.log('[evaluateCase] ===== 云函数被调用 =====');
  console.log('[evaluateCase] 收到参数:', JSON.stringify(event));

  try {
    const { text, _test, mode, imageFileIDs } = event;

    // ----- 0. 测试模式 -----
    if (_test) {
      console.log('[evaluateCase] 处于测试模式，跳过 DeepSeek 调用');
      return {
        code: 0,
        data: {
          judgment: {
            caseReview: '✅ 云函数连接成功！这是测试数据，说明云函数本身是通的。',
            catJudgment: '接下来需要排查 DeepSeek API 的调用链路。',
            finalVerdict: '测试模式 · 继续排查',
            punishment: '请查看云函数日志确认',
            whisper: '加油喵 🐱',
          },
        },
      };
    }

    // ----- 1. 参数校验 -----
    const hasText = !!(text || '').trim();
    const hasImages = !!(imageFileIDs && Array.isArray(imageFileIDs) && imageFileIDs.length > 0);
    if (!hasText && !hasImages) {
      console.warn('[evaluateCase] 参数为空（无文字也无图片）');
      return { code: -1, error: '好歹说一下发生了什么喵' };
    }
    console.log('[evaluateCase] 输入文本长度:', (text || '').length, '字符');
    console.log('[evaluateCase] 输入图片数量:', hasImages ? imageFileIDs.length : 0);

    // ----- 2. 检查 API Key -----
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'YOUR_DEEPSEEK_API_KEY') {
      console.error('[evaluateCase] DEEPSEEK_API_KEY 未配置');
      return { code: -2, error: '猫猫的钥匙丢了，请在云函数环境变量中配置 DEEPSEEK_API_KEY 喵' };
    }
    console.log('[evaluateCase] API Key 存在，长度:', apiKey.length);

    // ----- 3. OCR 识别截图（如果有） -----
    let finalText = (text || '').trim();
    let ocrTexts = [];

    if (hasImages) {
      try {
        console.log('[evaluateCase] 开始 OCR 识别截图...');
        ocrTexts = await ocrImages(imageFileIDs);
        console.log('[evaluateCase] OCR 识别完成，共', ocrTexts.length, '张截图');

        // 将 OCR 识别结果拼接到用户文本后
        for (let i = 0; i < ocrTexts.length; i++) {
          const ocrBlock = `\n\n【📷 聊天截图${ocrTexts.length > 1 ? ` ${i + 1}` : ''}内容】\n${ocrTexts[i]}`;
          finalText = finalText ? finalText + ocrBlock : ocrBlock;
        }
        console.log('[evaluateCase] 合并后文本长度:', finalText.length, '字符');
      } catch (err) {
        console.error('[evaluateCase] OCR 识别失败:', err.message);
        // OCR 失败但用户可能有手动输入的文字，不阻断流程
        if (!finalText) {
          return { code: -4, error: `截图识别失败了喵：${err.message}` };
        }
        console.log('[evaluateCase] 用户有手动输入，跳过截图继续审理');
      }
    }

    // ----- 4. 构建 system prompt -----
    const systemPrompt = mode === 'dual'
      ? SYSTEM_PROMPT + '\n\n【特别说明】本案为"双方陈述模式"，你已收到 A 方和 B 方各自的完整陈述。请在判词中着重分析双方视角的差异和共性，指出各自陈述中可能存在的盲点，保持最大限度的中立和公平。在【责任比例】中直接使用 A 方和 B 方。'
      : SYSTEM_PROMPT + '\n\n【特别说明】本案为"单人描述模式"，提交方默认为 A 方（用户本人），争吵中的另一半为 B 方。A 方 = 你方，B 方 = 对方。本法庭只听了一面之词，【责任比例】需带说明语气，判决倾向以调解为主。';

    // ----- 5. 调用 DeepSeek API（纯文本模式） -----
    console.log('[evaluateCase] 准备调用 DeepSeek API...');
    const startTime = Date.now();

    let rawContent;
    try {
      rawContent = await callDeepSeek(finalText, apiKey, systemPrompt);
    } catch (err) {
      console.error('[evaluateCase] DeepSeek 调用失败，耗时:', Date.now() - startTime, 'ms, 错误:', err.message);
      return { code: -3, error: `猫猫连线 DeepSeek 失败了喵：${err.message || '未知错误'}` };
    }

    console.log('[evaluateCase] DeepSeek 返回成功，耗时:', Date.now() - startTime, 'ms');
    console.log('[evaluateCase] 原始返回内容长度:', rawContent.length, '字符');

    // ----- 6. 结构化解析判词 -----
    console.log('[evaluateCase] 开始解析判词...');
    const judgment = parseJudgment(rawContent);
    console.log('[evaluateCase] 解析结果:', JSON.stringify({
      hasCaseReview: !!judgment.caseReview,
      hasCatJudgment: !!judgment.catJudgment,
      hasFinalVerdict: !!judgment.finalVerdict,
      hasPunishment: !!judgment.punishment,
      hasWhisper: !!judgment.whisper,
    }));

    if (!judgment.caseReview && !judgment.finalVerdict) {
      console.warn('[evaluateCase] 解析失败，未找到关键板块，返回原始内容');
      return { code: -5, error: '猫猫今天舌头打结了，判词格式有点奇怪喵', data: { rawContent } };
    }

    console.log('[evaluateCase] ===== 执行成功，总耗时:', Date.now() - startTime, 'ms =====');
    return { code: 0, data: { judgment, mode: mode || 'single' } };

  } catch (err) {
    console.error('[evaluateCase] ===== 未捕获异常 =====');
    console.error('[evaluateCase] 错误名:', err.name);
    console.error('[evaluateCase] 错误信息:', err.message);
    console.error('[evaluateCase] 错误堆栈:', err.stack);
    return { code: -9, error: `云函数执行异常：${err.message || '未知错误'}` };
  }
};

// ============================================================
// OCR 识别截图
// ============================================================
async function ocrImages(fileIDs) {
  const texts = [];
  for (const fileID of fileIDs) {
    console.log('[ocrImages] 识别 fileID:', fileID);
    const result = await cloud.openapi.ocr.printedText({ imgUrl: fileID });
    const lines = (result.items || []).map(item => item.text);
    const fullText = lines.join('\n');
    console.log('[ocrImages] 识别完成，文字长度:', fullText.length, '字符');
    texts.push(fullText);
  }
  return texts;
}

// ============================================================
// 通过 https 调用 DeepSeek API（纯文本，20 秒超时）
// ============================================================
function callDeepSeek(text, apiKey, systemPrompt) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.85,
      max_tokens: 2000,
    });

    const TIMEOUT_MS = 20000;

    console.log('[callDeepSeek] 请求体大小:', requestBody.length, 'bytes');
    console.log('[callDeepSeek] 目标: POST https://api.deepseek.com/v1/chat/completions');
    console.log('[callDeepSeek] 超时设置:', TIMEOUT_MS, 'ms');
    console.log('[callDeepSeek] 模式: 纯文本');

    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: TIMEOUT_MS,
    };

    const req = https.request(options);

    // ---- 响应处理 ----
    req.on('response', (res) => {
      console.log('[callDeepSeek] 收到响应，状态码:', res.statusCode);

      let body = '';

      res.on('data', (chunk) => {
        body += chunk.toString();
      });

      res.on('end', () => {
        console.log('[callDeepSeek] 响应接收完成，总大小:', body.length, 'bytes');
        clearTimeout(timer);

        if (res.statusCode !== 200) {
          console.error('[callDeepSeek] 非 200 响应:', res.statusCode);
          console.error('[callDeepSeek] 响应体:', body.slice(0, 500));
          let errorMsg = `DeepSeek API 返回状态码 ${res.statusCode}`;
          try {
            const errJson = JSON.parse(body);
            if (errJson.error?.message) errorMsg += `: ${errJson.error.message}`;
          } catch (e) { /* ignore */ }
          reject(new Error(errorMsg));
          return;
        }

        try {
          const json = JSON.parse(body);
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            console.log('[callDeepSeek] 成功提取 content，长度:', content.length);
            resolve(content);
          } else {
            console.error('[callDeepSeek] content 为空');
            reject(new Error('DeepSeek 返回了空内容'));
          }
        } catch (e) {
          console.error('[callDeepSeek] JSON 解析失败:', e.message);
          reject(new Error(`解析 DeepSeek 响应失败：${e.message}`));
        }
      });
    });

    // ---- 错误处理 ----
    req.on('error', (e) => {
      console.error('[callDeepSeek] 请求错误:', e.name, '-', e.message);
      clearTimeout(timer);
      reject(new Error(`请求 DeepSeek 失败：${e.message}`));
    });

    // ---- socket 超时 ----
    req.on('timeout', () => {
      console.error('[callDeepSeek] socket 超时（', TIMEOUT_MS, 'ms）');
      req.destroy();
      clearTimeout(timer);
      reject(new Error(`DeepSeek API socket 超时（${TIMEOUT_MS}ms）`));
    });

    // ---- setTimeout 兜底 ----
    const timer = setTimeout(() => {
      console.error('[callDeepSeek] setTimeout 超时（', TIMEOUT_MS, 'ms）');
      req.destroy();
      reject(new Error(`DeepSeek API 请求超时（${TIMEOUT_MS}ms）`));
    }, TIMEOUT_MS);

    // ---- 发送 ----
    req.write(requestBody);
    req.end();
    console.log('[callDeepSeek] 请求已发送');
  });
}

// ============================================================
// 解析函数：正则提取 6 个板块（含责任比例）
// ============================================================
function parseJudgment(content) {
  const sections = {};

  const patterns = [
    { key: 'caseReview',    pattern: /【案件回顾】([\s\S]*?)(?=【责任比例】|【猫猫判词】|【终审判决】|【惩罚措施】|【🐱\s*本庭的悄悄话】|【🐱本庭的悄悄话】|$)/ },
    { key: 'respRaw',       pattern: /【责任比例】([\s\S]*?)(?=【猫猫判词】|【终审判决】|【惩罚措施】|【🐱\s*本庭的悄悄话】|【🐱本庭的悄悄话】|$)/ },
    { key: 'catJudgment',   pattern: /【猫猫判词】([\s\S]*?)(?=【终审判决】|【惩罚措施】|【🐱\s*本庭的悄悄话】|【🐱本庭的悄悄话】|$)/ },
    { key: 'finalVerdict',  pattern: /【终审判决】([\s\S]*?)(?=【惩罚措施】|【🐱\s*本庭的悄悄话】|【🐱本庭的悄悄话】|$)/ },
    { key: 'punishment',    pattern: /【惩罚措施】([\s\S]*?)(?=【🐱\s*本庭的悄悄话】|【🐱本庭的悄悄话】|$)/ },
    { key: 'whisper',       pattern: /【🐱?\s*本庭的悄悄话】([\s\S]*?)$/ },
  ];

  for (const { key, pattern } of patterns) {
    const match = content.match(pattern);
    sections[key] = match ? match[1].trim() : '';
  }

  // 从责任比例原文中提取数字
  if (sections.respRaw) {
    const aMatch = sections.respRaw.match(/A\s*方[^0-9]*?(\d+)/i);
    const bMatch = sections.respRaw.match(/B\s*方[^0-9]*?(\d+)/i);
    const aPct = aMatch ? Math.min(100, Math.max(0, parseInt(aMatch[1], 10))) : 50;
    const bPct = bMatch ? Math.min(100, Math.max(0, parseInt(bMatch[1], 10))) : 50;
    const total = aPct + bPct;
    sections.responsibility = {
      aPercent: total > 0 ? Math.round((aPct / total) * 100) : 50,
      bPercent: total > 0 ? Math.round((bPct / total) * 100) : 50,
    };
    if (sections.responsibility.aPercent + sections.responsibility.bPercent !== 100) {
      sections.responsibility.aPercent = 100 - sections.responsibility.bPercent;
    }
  }

  delete sections.respRaw;
  return sections;
}
