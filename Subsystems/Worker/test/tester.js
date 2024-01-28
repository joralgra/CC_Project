const nats = require('nats');
const blobUtil = require('blob-util');
const uuid = require('uuid');
const fs = require("fs");
const path = require("path");

const inputMsgExample = {
    user: "8cb2f9c7-2e9b-4bdc-9fe7-3d6a1a9a45e8",
    jobId: "e8d4aaf5-56cf-48a0-af82-7391c6db09d2",
    // imageObjStoreName : "e8d4aaf5-56cf-48a0-af82-7391c6db09d2-input"

}

const originalKvValue = {
    user: "8cb2f9c7-2e9b-4bdc-9fe7-3d6a1a9a45e8",
    jobId: "e8d4aaf5-56cf-48a0-af82-7391c6db09d2",
    state: "ENQUEUED",
    result: null
}

// Connections to NATS
let nc = null;
let js = null;
let objStoreService = null;
let statesKVService = null;
let logsKVService = null;

(async function () {
    console.log("🎇⏳ Connecting to NATS...")

    // Connections to NATS
    const NATS_URI = process.env.NATS_URI;
    nc = await nats.connect({servers: [NATS_URI], json: true});

    // pub = nc.publish("jobqueue", {queue: "jobqueue"});

    js = nc.jetstream();

    objStoreService = await js.views.os("data");
    statesKVService = await js.views.kv("jobState");
    logsKVService = await js.views.kv("logs");

    console.log("🎇🟢 Connected to NATS")

})().then(test_multiple_jobs);


async function test_multiple_jobs() {
    for (let i = 0; i < 100; i++) {
        await send_sample_job();
    }
}


async function send_sample_job() {

    console.log(" Sending sample work...")
    let jobId = inputMsgExample.jobId;
    let userId = inputMsgExample.user;

    await putKV(userId + "." + jobId, originalKvValue);

    // Load blob out of file
    let blob = fs.readFileSync(path.resolve(__dirname, '../imgs_src/da.jpeg'));
    // const img = await canvas.loadImage('imgs_src/da.jpeg')
    // Store blob in object store
    let blob_name = inputMsgExample.jobId + "-input";
    await storeBlob(blob_name, blob);


    nc.publish("job", JSON.stringify(inputMsgExample));
    console.log(" 🟢 Sample work sent");
}

/* ---------------------------------- */
/* -------- NATS OPERATIONS --------- */
/* ---------------------------------- */
async function putKV(key, value) {
    // Store in NATS KV
    await statesKVService.put(key, JSON.stringify(value));
}

async function getKV(key) {
    // Get from NATS KV
    let entry = await statesKVService.get(key);
    console.log(`${entry?.key} @ ${entry?.revision} -> ${entry?.string()}`);

    return JSON.parse(entry?.string());

}

async function storeBlob(blob_name, blob) {
    // Store blob in NATS object store
    await objStoreService.putBlob({name: blob_name}, blob);
}

async function getBlob(blob_name) {
    // Get blob from NATS object store
    return await objStoreService.getBlob(blob_name);
}

/* ---------------------------------- */
/* ---- END OF NATS OPERATIONS ------ */
/* ---------------------------------- */