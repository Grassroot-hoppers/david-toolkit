import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "demo");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

http
  .createServer((req, res) => {
    const requested = req.url === "/" ? "/index.html" : req.url;
    const filePath = path.join(root, requested);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const finalPath = fs.existsSync(filePath) ? filePath : path.join(root, "index.html");
    const ext = path.extname(finalPath);

    try {
      const data = fs.readFileSync(finalPath);
      res.writeHead(200, { "Content-Type": types[ext] || "text/plain; charset=utf-8" });
      res.end(data);
    } catch (error) {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, () => {
    console.log(`David Toolkit available at http://localhost:${port}`);
  });

