import {
  chmodRecursiveSync,
  createPocketBaseInstance,
  downloadPB,
  killPocketBaseProcesses,
  startPocketBaseInstance,
  unzipFile
} from "./pocketbase";
import { checkFolderExists } from "./util/fileUtil";
import http from "http";
import https from "https";
import httpProxy from "http-proxy";
import fs from "fs";
import path from "path";

const sslOptions = {
  key: fs.readFileSync(process.env.KEY!, "utf8"),
  cert: fs.readFileSync(process.env.CERT!, "utf8")
};

// Create a proxy server
const proxy = httpProxy.createProxyServer({});
const apps: Map<String, number> = new Map();

const instances = process.env.APPS?.split(",") || [];
console.log("INSTANCES: ", instances);
var port = 8000;

await downloadPB();
await unzipFile(
  `../pocketbase_template/${process.env.PB_V}.zip`,
  `../pocketbase_template/PB_${process.env.PB_V}`
);

//await chmodRecursiveSync(`./pocketbase_template/PB_${process.env.PB_V}`, 0o755)
//await chmodRecursiveSync(path.join(__dirname, '..', './pocketbase_instances'), 2)
await killPocketBaseProcesses();

for (let instance of instances) {
  const exists = checkFolderExists("./pocketbase_instances/" + instance);
  if (!exists) {
    await createPocketBaseInstance(instance);
    await chmodRecursiveSync(
      path.join(__dirname, "..", "./pocketbase_instances", instance),
      0o755
    );
  }

  const instancePort = port++;
  apps.set(instance, instancePort);
  await startPocketBaseInstance(instance, instancePort);
}

const patternString = instances.join("|");
const urlPatterns = new RegExp(`^/(${patternString})(/.*)?$`);

// Create an HTTPS server
const server = https.createServer(sslOptions, (req: any, res: any) => {
  const match = req.url.match(urlPatterns);
  if (match) {
    const appName = match[1];
    req.url = req.url.replace(urlPatterns, "$2");
    proxy.web(req, res, { target: `http://127.0.0.1:${apps.get(appName)}/` });
  } else {
    // Handle non-proxied requests here
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Non-proxied request");
  }
});

// Start the server
server.listen(443, () => {
  console.log("Server is running on https://localhost:3000");
});

// Create an HTTP server for redirect
const httpServer = http.createServer((req, res) => {
  // Redirect to HTTPS
  res.writeHead(301, { Location: "https://" + req.headers.host + req.url });
  res.end();
});

httpServer.listen(80, () => {
  console.log("HTTP Server is running on http://localhost:80");
});
