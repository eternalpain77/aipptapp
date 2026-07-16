const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.method === "POST" && req.url === "/api/generate-ppt") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, test: "api works" }));
  }
  
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("AI PPT Backend OK");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
