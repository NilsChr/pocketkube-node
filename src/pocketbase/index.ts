import { getFreePort } from "../util/network";
import { setupAdminSchema, setupRootAdmin } from "./admin";
import {
  createPocketBaseInstance,
  deletePocketBaseInstance,
  startPocketBaseInstance
} from "./instance";
import { killPocketBaseProcesses, killProcketBaseProcess } from "./processes";
import PocketBase, { RecordModel } from "pocketbase";
import eventsource from "eventsource";
import "cross-fetch/polyfill";

export * from "./admin";
export * from "./instance";
export * from "./processes";

//@ts-ignore
global.EventSource = eventsource;

let pb: PocketBase;
let instances: Map<string, RecordModel> = new Map();
let timers: Map<string, NodeJS.Timeout> = new Map();

export { pb, instances, timers };

export async function initializePocketBase() {
  console.log("Killing all pocketbase instances");
  await killPocketBaseProcesses();
  await startPocketBaseInstance("admin", 8000);

  console.log("Setting up root admin");
  await setupRootAdmin();

  const pbUrl = "http://127.0.0.1:8000";
  pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  console.log("Authenticatig to admin");
  await authenticateAdmin();
  console.log("Setting up admin schema");
  await setupAdminSchema(pb);
  console.log("Update instances");
  await updateInstances();
  console.log("Reset run variables");
  await resetRunVariables();
  console.log("Update instances");
  await updateInstances();

  console.log("Start active instances");
  startActiveInstances();
}

async function authenticateAdmin() {
  await pb.admins.authWithPassword(
    process.env.ADMIN_USER || "",
    process.env.ADMIN_PW || ""
  );
}

export async function updateInstances() {
  instances.set("admin", {
    id: "admin",
    title: "admin",
    activePORT: 8000,
    running: true,
    collectionId: "instances",
    collectionName: "instances",
    created: "",
    updated: ""
  });
  let records = await pb.collection("instances").getFullList();
  for (let record of records) {
    instances.set(record.id, record);
  }
}
async function resetRunVariables() {
for (let instance of Array.from(instances.values()).filter(app => app.id !== "admin")) {
    await pb.collection("instances").update(instance.id, {
      activePID: null,
      activePORT: null,
      running: false
    });
  }
}

function startActiveInstances() {
  for (let instance of instances.values()) {
    if (instance.active) startApp(instance.id);
  }
}

export async function startApp(id: string) {
  const instance = instances.get(id);
  if (instance) {
    if (
      instance.running === true ||
      instance.activePID !== 0 ||
      instance.activePORT !== 0
    ) {
      console.log("Not starting already running app.");
      return;
    }
  }

  const port = await getFreePort(8000, 10000);
  const pid = await startPocketBaseInstance(id, port);
  const record = await pb
    .collection("instances")
    .update(id, { activePID: pid, activePORT: port, running: true });
  startTimer(record.id);
}

export function startTimer(id: string) {
  clearTimeout(timers.get(id));
  let timer = setTimeout(async () => {
    const instance = instances.get(id);
    if (instance === undefined) return;
    await killProcketBaseProcess(instance.activePID);
    await pb.collection("instances").update(instance.id, {
      activePID: null,
      activePORT: null,
      running: false
    });
    updateInstances();
  }, 60000);
  timers.set(id, timer);
}

export async function handleCreateEvent(record: RecordModel) {
  await createPocketBaseInstance(record.id);
  await startApp(record.id);
  await updateInstances();
}

export async function handleDeleteEvent(record: RecordModel) {
  await killProcketBaseProcess(record.activePID);
  deletePocketBaseInstance(record.id);
  instances.delete(record.id);
}
