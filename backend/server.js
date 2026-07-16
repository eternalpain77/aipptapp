import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// 允许 GitHub Pages 前端跨域访问 Render 后端
app.use(cors({
  origin: [
    "https://eternalpain77.github.io",
    "http://localhost:3000"
  ]
}));
app.use(express.json());

// 根路由（教程要求：方便浏览器验证）
app.get("/", (req, res) => {
  res.send("AI PPT Backend is running");
});

// 用于前端调用的路由：生成 PPT 文案
app.post("/api/generate-ppt", async (req, res) => {
  try {
    const { topic, content, extra } = req.body;

    if (!topic && !content) {
      return res.status(400).json({ error: "缺少必要的输入：至少需要主题或演讲内容" });
    }

    // 把用户输入拼成给大模型的提示词
    const userPrompt = `
你是一个帮用户生成演讲用 PPT 的助手。

用户的主题：
${topic || "（未提供主题）"}

用户的演讲内容或要点：
${content || "（未提供演讲内容）"}

补充要求或细节：
${extra || "（无补充说明）"}

请你输出一份 PPT 结构建议，使用 JSON 格式，包含：
- title: 整个演示的标题
- slides: 每一页的数组，每页包含：
  - title: 页标题
  - bullets: 字符串数组，每个元素是一条要点，尽量简短、有逻辑，适合直接放在 PPT 上。

只输出 JSON，不要多余解释。`;

    const apiUrl = process.env.MODEL_API_URL;
    const modelName = process.env.MODEL_NAME;
    const apiKey = process.env.MODEL_API_KEY;

    if (!apiUrl || !modelName || !apiKey) {
      return res.status(500).json({ error: "后端环境变量未正确配置，请检查 .env" });
    }

    // 调用 OpenRouter 免费模型
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "你是一个专业的 PPT 结构和文案生成助手。输出只用 JSON。"
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenRouter API error:", response.status, text);
      return res.status(500).json({
        error: "调用大模型接口失败",
        detail: text
      });
    }

    const data = await response.json();

    // 按 OpenRouter / chat-completions 标准结构取出内容
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(500).json({ error: "模型没有返回内容" });
    }

    // 尝试把返回内容解析为 JSON（兼容模型偶尔包裹的 ```json 代码块或前后多余文字）
    let pptStructure;
    try {
      const cleaned = rawContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      // 容错：截取第一个 { 到最后一个 } 之间的内容，避免前后多余文字导致解析失败
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      const jsonStr = (start !== -1 && end !== -1 && end > start)
        ? cleaned.slice(start, end + 1)
        : cleaned;
      pptStructure = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON 解析失败，原始内容：", rawContent);
      return res.status(500).json({
        error: "模型返回的内容不是合法 JSON，请重试",
        raw: rawContent
      });
    }

    // 结构校验：确保返回了标题和至少一页内容
    if (!pptStructure || typeof pptStructure !== "object"
        || !Array.isArray(pptStructure.slides) || pptStructure.slides.length === 0) {
      return res.status(500).json({ error: "模型返回结构不完整，请重试" });
    }

    // 返回给前端
    res.json({
      ok: true,
      ppt: pptStructure
    });
  } catch (err) {
    console.error("服务器内部错误：", err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// 教程要求：用 process.env.PORT || 3000，listen 加 "0.0.0.0"
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
