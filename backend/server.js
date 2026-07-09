import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
        // 下面两个是可选的，用来在 OpenRouter 排行里显示你的应用名
        // "HTTP-Referer": "https://你的站点或GitHub地址",
        // "X-Title": "AI PPT App"
      },
      body: JSON.stringify({
        model: modelName, // 这里用 openrouter/free 或具体免费模型
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

    // 尝试把返回内容解析为 JSON
    let pptStructure;
    try {
      // 有些模型会返回带 ```json ... ``` 的代码块，这里做一下清洗
      const cleaned = rawContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      pptStructure = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON 解析失败，原始内容：", rawContent);
      return res.status(500).json({
        error: "模型返回的内容不是合法 JSON",
        raw: rawContent
      });
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

app.get("/", (req, res) => {
  res.send("AI PPT 后端已运行");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
