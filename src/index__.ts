import { createProxyMiddleware } from "http-proxy-middleware";
import {
  createPocketBaseInstance,
  handleCreateEvent,
  handleDeleteEvent,
  initializePocketBase,
  // instances,
  pb,
  startApp,
  startPocketBaseInstance,
  startTimer,
  updateInstances
} from "./pocketbase";
import express, { NextFunction, Request, Response } from "express";
import vhost from "vhost";
const httpProxy = require('http-proxy');
const http = require('http');


const fs = require("fs");
const https = require("https");
const path = require("path");

const app = express();
/*
async function main() {
  console.log("Main");
  await initializePocketBase();
  setupInstanceSubscription();
  console.log(instances);
}


function setupInstanceSubscription() {
  pb.collection("instances").subscribe(
    "*",
    async (event) => {
      if (event.action === "create") {
        await handleCreateEvent(event.record);
      }
      if (event.action === "delete") {
        await handleDeleteEvent(event.record);
      } else if (event.action === "update") {
        await updateInstances();
      }
    },
    {}
  );
}
*/
// Define a simple route
app.get("/", (req: any, res: any) => {
  res.send("Hello, HTTPS world!");
});

/*
app.use("/:title", async (req: Request, res: Response, next: NextFunction) => {

  const title = req.params.title || 'admin'
  console.log('APP USE: '+title)
  let instance = Array.from(instances.values()).find(
    (a) => a.title === title
  );
  if (!instance) {
    return res.status(404).send("Instance not found");
  }

  if (instance.running === false) {
    await startApp(instance.id);
    await updateInstances();
    instance = instances.get(instance.id);
  }

  startTimer(instance!.id);

  const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:${instance!.activePORT}`,
    changeOrigin: true,
    pathRewrite: {
      [`^/${instance!.title}`]: ""
    },
    onError: (err, req, res) => {
      res.status(500).send("Proxy error");
    }
  });

  proxy(req, res, next);
});
*/

const instances = process.env.APPS?.split(",") || [];

var port = 8000;

for (let instance of instances) {

  const instancePORT = port++;
  await createPocketBaseInstance(instance)
  await startPocketBaseInstance(instance, instancePORT)
  app.use(
    `/${instance}`,
    async (req: Request, res: Response, next: NextFunction) => {
      const proxy = createProxyMiddleware({
        target: `http://127.0.0.1:${instancePORT}`,
        changeOrigin: true,
        pathRewrite: {
          [`^/${instance}`]: ""
        },
        onError: (err, req, res) => {
          res.status(500).send("Proxy error");
        }
      });

      proxy(req, res, next);
    }
  );
}

/*

app.use("/admin", async (req: Request, res: Response, next: NextFunction) => {
  const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:8000`,
    changeOrigin: true,
    pathRewrite: {
      "admin": ""
    },
    onError: (err, req, res) => {
      res.status(500).send("Proxy error");
    }
  });

  proxy(req, res, next);
})
*/
/*
await startPocketBaseInstance("app1", 8000);
app.use("/app1", async (req: Request, res: Response, next: NextFunction) => {
  const proxy = createProxyMiddleware({
    target: `http://127.0.0.1:8000`,
    changeOrigin: true,
    pathRewrite: {
      [`^/app1`]: ""
    },
    onError: (err, req, res) => {
      res.status(500).send("Proxy error");
    }
  });

  proxy(req, res, next);
})
*/

// Read the SSL certificate files
const privateKey = fs.readFileSync(path.join(__dirname, "../key.pem"), "utf8");
const certificate = fs.readFileSync(
  path.join(__dirname, "../cert.pem"),
  "utf8"
);

const credentials = { key: privateKey, cert: certificate };

// Create HTTPS server
const httpsServer = https.createServer(credentials, app);

// Set the port and start the server
const PORT = 3000;
httpsServer.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
  //main();
});
