const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = 5500;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const serveFile = (targetPath) => {
    fs.readFile(targetPath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(targetPath)] || "application/octet-stream",
      });
      response.end(content);
    });
  };

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      serveFile(filePath);
      return;
    }

    if (/^(?:[^/]+\/)?user\/[^/]+$/.test(requestPath.slice(1))) {
      serveFile(path.join(root, "index.html"));
      return;
    }

    response.writeHead(404);
    response.end("Not found");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Twottor running at http://127.0.0.1:${port}`);
});
