import path from "path";
import { copyDirectory, deleteDirectorySync } from "../util/fileUtil";
import { exec } from "child_process";
import fs from "fs";

export function createPocketBaseInstance(id: string) {
  const sourcePath = path.join(__dirname, "../../", "pocketbase_template");
  const destinationPath = path.join(
    __dirname,
    "../../",
    "pocketbase_instances",
    id
  );
  copyDirectory(sourcePath, destinationPath);
}

export function deletePocketBaseInstance(id: string) {
  const instancePath = path.join(__dirname, "../../", "pocketbase_instances", id);
  console.log("DELETING", instancePath);
  deleteDirectorySync(instancePath);
}

export function startPocketBaseInstance(
  appId: string,
  port: number
): Promise<number | undefined> {
  console.log(`Starting pocketbase instance ${appId} on port: ${port}`);

  return new Promise((resolve, reject) => {
    const cwdPath = path.join(__dirname, `../../pocketbase_instances/${appId}`);
    const process = exec(`./pocketbase serve --http="127.0.0.1:${port}"`, {
      cwd: cwdPath
    });

    if (!process.stdout || !process.stderr)
      return reject("App didnt start as expected.");

    process.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
      const regex = /http:\/\/127\.0\.0\.1:(\d+)/;
      const match = data.match(regex);
      let port = -1;
      if (match) {
        port = match[1]; // The first capture group
      } else {
      }
      resolve(process.pid);
    });

    process.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    process.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
    });
  });
}
