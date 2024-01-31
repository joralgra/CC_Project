const faceapi = require("face-api.js")
// require('@tensorflow/tfjs-node');

const canvas = require("canvas")
const fs = require("fs")
const path = require("path")

const nats = require('nats');
const blobUtil = require('blob-util');
const uuid = require('uuid');

const {
    AckPolicy,
    connect,
    millis,
    nuid,
    RetentionPolicy
} = require('nats');

// mokey pathing the faceapi canvas
const {Canvas, Image, ImageData} = canvas
faceapi.env.monkeyPatch({Canvas, Image, ImageData})

// Connections to NATS
let nc = null;
let sub = null;
let js = null;
let objStoreService = null;
let statesKVService = null;
let workerKVService = null;
let c2 = null;
let cObs = null;
let streamName = null;

// Model Setup
const faceDetectionNet = faceapi.nets.ssdMobilenetv1
// SsdMobilenetv1Options
const minConfidence = 0.5
// TinyFaceDetectorOptions
const inputSize = 408
const scoreThreshold = 0.5
// MtcnnOptions
const minFaceSize = 50;
const scaleFactor = 0.8;

(async function () {
    console.log("🎇⏳ Loading weights...")
    // load weights
    await faceDetectionNet.loadFromDisk(path.join(__dirname, './weights'))
    await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, './weights'))
    await faceapi.nets.faceExpressionNet.loadFromDisk(path.join(__dirname, './weights'))
    await faceapi.nets.ageGenderNet.loadFromDisk(path.join(__dirname, './weights'))
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(__dirname, './weights'))
    await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, './weights'))
    console.log("🎇🟢 Weights loaded")

    console.log(" 🎇⏳ Connecting to NATS...")
    // Connections to NATS
    const NATS_URI = process.env.NATS_URI;

    // const NATS_URI = "nats://127.0.0.1:4222";

    console.log("@ -> " + NATS_URI)

    nc = await nats.connect({servers: [NATS_URI], json: true});

    js = nc.jetstream();

    const WORK_QUEUE = 'workQueueStream';
    const OBS_QUEUE = 'observerQueueStream';
    const WORK_SUBJECT = 'subjectJob';
    const OBS_SUBJECT = 'subjectObserver';

    const jsm = await nc.jetstreamManager()

    // sub = nc.subscribe("job", {queue: "job"});
    try {
        c2 = await js.consumers.get(WORK_QUEUE, WORK_SUBJECT);
        cObs = await js.consumers.get(OBS_QUEUE, OBS_SUBJECT);
    } catch (e) {
        console.log("🧨 ERROR: " + e);
        console.log(" 🎇⏳ Creating consumers...")

        // await jsm.consumers.add(WORK_QUEUE, {
        //     ack_policy: AckPolicy.Explicit,
        //     durable_name: WORK_SUBJECT,
        //     // filter_subject: `${WORK_SUBJECT}`,
        // });
        await jsm.consumers.add(OBS_QUEUE, {
            ack_policy: AckPolicy.Explicit,
            durable_name: OBS_SUBJECT,
            // filter_subject: `${OBS_SUBJECT}`,
        });

        // c2 = await js.consumers.get(WORK_QUEUE, WORK_SUBJECT);
        cObs = await js.consumers.get(OBS_QUEUE, OBS_SUBJECT);
        console.log(" 🎇🟢 Consumers created");
    }

    objStoreService = await js.views.os("data");
    statesKVService = await js.views.kv("jobState");
    workerKVService = await js.views.kv("workerState");

    console.log(" 🎇🟢 Connected to NATS")

})().then(start_engine);

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

let isOperative = true;

async function start_engine() {

    let worker_nuid = nuid.next();
    let workerKVkey = "worker." + worker_nuid;
    // Worker Engine loop
    console.log("  - - - STARTING WORKER - - -")

    while (isOperative) {

        // Last Alive
        // let wkv = await getKVWorkerState(workerKVkey)
        // wkv.alive_time = new Date();
        // putKVWorkerState(workerKVkey, JSON.stringify(wkv));

        let messages = await c2.fetch({max_messages: 1});
        // Convert the iterable to an array
        // let count = 0;
        // for await(const msg of messages) count++; // What a shitty way, but this is a shitty iterable
        // console.log("✉ Received " + (count > 0? "a": "no") + " message.")
        await compute_unit(messages, worker_nuid);

        await millis(1000);

        let obsMessages = await cObs.fetch({max_messages: -1});
        // count = 0;
        // for await(const msg of messages) count++; // What a shitty way, but this is a shitty iterable
        // console.log("💌 Received " + (count > 0? "a": "no") + " observer message.")
        await check_system(obsMessages, workerKVkey, worker_nuid);
        console.log("Relaunch listener...")

    }

    console.log("  - - - FINISHING WORKER - - -")
}

async function check_system(obsMessages, thisworkerKV_Key, worker_id) {

    for await(const msg of obsMessages) {

        let pmsg = JSON.parse(Buffer.from(msg.data).toString());

        if (pmsg.id !== worker_id) continue;

        if (pmsg.action === "DOWN") {

            msg.ack();
            console.log("🔴 System is going down by observer request...")
            deleteKVWorkerState(thisworkerKV_Key);
            process.exitCode = 0
            process.exit();
            // isOperative = false;
        } else {
            // msg.ack();
            continue;
        }
    }

}

async function compute_unit(messages,workerKVkey,worker_nuid) {

    for await(const msg of messages) {

        try {
            putKVWorkerState(workerKVkey, JSON.stringify({
                // alive_time: new Date(),
                id: worker_nuid,
                last_time_executed: new Date()
            }));

            msg.ack();
            console.log("🟢 Processing job...")

            const startTime = process.hrtime();

            // Realiza alguna tarea que quieres medir
            console.log("✉ ✉ ✉ ✉ ✉");
            // console.log(msg.string());

            let pmsg = JSON.parse(Buffer.from(msg.data).toString());

            let userId = pmsg.user;
            let jobId = pmsg.jobId;
            console.log("Working on job [" + jobId + "]");
            console.log("For User [" + userId + "]");

            // TODO: Validate the msg

            // Tell KV we are prepared, state PENDING
            let kvValue = await getKV(userId + "." + jobId);
            kvValue.state = "PENDING";
            kvValue.startTime = new Date().toISOString();
            kvValue.workerId = worker_nuid;
            await updateKV(userId + "." + jobId, kvValue);



            console.log(" -> PENDING PHASE ")

            // Get the Blob from the Object Store
            let blob = await getBlob(jobId + "-input");
            let mimetype = pmsg?.image?.mimetype;

            // Tell the KV we are running, state RUNNING
            kvValue = await getKV(userId + "." + jobId);
            kvValue.state = "RUNNING";
            await updateKV(userId + "." + jobId, kvValue);
            console.log(" -> RUNNING PHASE ")

            // Run the job
            let resBuffer = await execute_model(blob)

            // Store the Blob in the Object Store
            let blob_name = jobId + "-output";
            await storeBlob(blob_name, resBuffer);

            // Tell the KV we are done, state DONE
            kvValue = await getKV(userId + "." + jobId);
            kvValue.state = "FINISHED";

            const elapsedTime = process.hrtime(startTime);
            const elapsedTimeInMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;

            console.log(`Process elapsed time: ${elapsedTimeInMs} ms`);
            kvValue.elapsedTime = elapsedTimeInMs;

            await updateKV(userId + "." + jobId, kvValue);
            console.log(" --> FINISHED PROCESSING JOB [" + jobId + "]");

        } catch (e) {
            console.log(" 🧨 ERROR: " + e);
            let kvValue = await getKV(userId + "." + jobId);
            kvValue.state = "ERROR";
            kvValue.errorMsg = e;
            await updateKV(userId + "." + jobId, kvValue);
            console.log(" --> ENDED JOB ABRUPTLY [" + jobId + "]")
            msg?.ack();
        }
    }

    // console.log("Relaunch listener...")


}

function getFaceDetectorOptions(net) {
    return net === faceapi.nets.ssdMobilenetv1
        ? new faceapi.SsdMobilenetv1Options({minConfidence})
        : (net === faceapi.nets.tinyFaceDetector
                ? new faceapi.TinyFaceDetectorOptions({inputSize, scoreThreshold})
                : new faceapi.MtcnnOptions({minFaceSize, scaleFactor})
        )
}

const faceDetectionOptions = getFaceDetectorOptions(faceDetectionNet)

// simple utils to save files
const outputBaseDir = path.resolve(__dirname, './out')

function saveFile(fileName, buf) {
    if (!fs.existsSync(outputBaseDir)) {
        fs.mkdirSync(outputBaseDir)
    }
    // this is ok for prototyping but using sync methods
    // is bad practice in NodeJS
    fs.writeFileSync(path.resolve(outputBaseDir, fileName), buf)
}

async function execute_model(blob) {

    console.log("Running model ...")

    // Convierte el blob a un objeto de imagen
    // const imageUrl = await blobUtil.createObjectURL(blob);
    const buffer = Buffer.from(blob);

    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    // load the image
    const img = await canvas.loadImage(dataUrl)


    // detect the faces with landmarks
    // const results = await faceapi.detectAllFaces(img, faceDetectionOptions)
    //     .withFaceLandmarks()
    const results =
        await faceapi.detectAllFaces(img)
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender()
            .withFaceDescriptors();


    // OLD create a new canvas and draw the detection and landmarks
    // const out = faceapi.createCanvasFromMedia(img)
    // faceapi.draw.drawDetections(out, results.map(res => res.detection))
    // faceapi.draw.drawFaceLandmarks(out, results.map(res => res.landmarks), {drawLines: true, color: 'red'})
    // faceapi.draw.drawFaceExpressions(out, results.map(res => res.expressions))

    const out = faceapi.createCanvasFromMedia(img)
    faceapi.draw.drawDetections(out, results.map(res => res.detection))
    faceapi.draw.drawFaceExpressions(out, results)

    // save the new canvas as image
    // saveFile('executionTest.jpg', out.toBuffer('image/jpeg'))
    // console.log('done, saved results to out/faceLandmarkDetection.jpg')

    console.log("Success ✨")
    return out.toBuffer('image/jpeg');
    // return out.toBuffer('image/jpeg');
}


async function runFromFile() {

    console.log("Running from file...")


    // load the image
    const img = await canvas.loadImage('imgs_src/da.jpeg')


    // detect the faces with landmarks
    // const results = await faceapi.detectAllFaces(img, faceDetectionOptions)
    //     .withFaceLandmarks()
    const results =
        await faceapi.detectAllFaces(img)
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender()
            .withFaceDescriptors();


    // create a new canvas and draw the detection and landmarks
    const out = faceapi.createCanvasFromMedia(img)
    faceapi.draw.drawDetections(out, results.map(res => res.detection))
    faceapi.draw.drawFaceLandmarks(out, results.map(res => res.landmarks), {drawLines: true, color: 'red'})
    faceapi.draw.drawFaceExpressions(out, results.map(res => res.expressions))


    // save the new canvas as image
    saveFile('faceLandmarkDetection.jpg', out.toBuffer('image/jpeg'))
    console.log('done, saved results to out/faceLandmarkDetection.jpg')
}


/* ---------------------------------- */
/* -------- NATS OPERATIONS --------- */

/* ---------------------------------- */
async function updateKV(key, value) {
    // Store in NATS KV
    await statesKVService.update(key, JSON.stringify(value));
}


async function getKVWorkerState(key) {
    let entry = await workerKVService.get(key);
    // console.log(`KV get Op: ${entry?.key} @ ${entry?.revision} -> ${entry?.string()}`);

    return JSON.parse(entry?.string());
}
async function putKVWorkerState(key, value) {
    // Store in Worker State NATS KV
    await workerKVService.put(key, value);
}

async function deleteKVWorkerState(key) {
    // Store in Worker State NATS KV
    await workerKVService.delete(key);
}


async function getKV(key) {
    // Get from NATS KV
    let entry = await statesKVService.get(key);
    // console.log(`KV get Op: ${entry?.key} @ ${entry?.revision} -> ${entry?.string()}`);

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

async function kvTest() {
    const exampleJson = {
        user: "test-8cb2f9c7-2e9b-4bdc-9fe7-3d6a1a9a45e8",
        jobId: "test-e8d4aaf5-56cf-48a0-af82-7391c6db09d2",
        state: "ENQUEUED",
        result: null
    }

    let key = exampleJson.user + "." + exampleJson.jobId;
    await updateKV(key, exampleJson);
    let result = await getKV(key);

    console.log("📣 KV test done.")
    console.log(result)

}


async function storeBlobTest() {
    // Print filesystem
    // console.log(fs.readdirSync('imgs_src'))

    // Load blob out of file
    let blob = fs.readFileSync(path.resolve(__dirname, './imgs_src/da.jpeg'));
    // const img = await canvas.loadImage('imgs_src/da.jpeg')
    // Store blob in object store
    let blob_name = inputMsgExample.jobId + "-input";
    await storeBlob(blob_name, blob);

    await readBlobTest()
}

async function readBlobTest() {
    let blob_name = inputMsgExample.jobId + "-input";
    let blob = await getBlob(blob_name);
    console.log(blob);

    // Store in disk
    saveFile('test.jpg', blob)
}

// storeBlobTest()
// setup()