const faceapi = require("face-api.js")
const canvas = require("canvas")
const fs = require("fs")
const path = require("path")

const nats = require('nats');
const blobUtil = require('blob-util');
const uuid = require('uuid');

// mokey pathing the faceapi canvas
const {Canvas, Image, ImageData} = canvas
faceapi.env.monkeyPatch({Canvas, Image, ImageData})



// Connections to NATS
let nc = null;
let sub = null;
let js = null;
let objStoreService = null;
let statesKVService = null;
let logsKVService = null;


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
    console.log( "🎇⏳ Loading weights...")
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
    nc = await nats.connect({servers: [NATS_URI], json: true});

    sub = nc.subscribe("jobqueue", {queue: "jobqueue"});

    js = nc.jetstream();
    objStoreService = await js.views.os("configs");
    statesKVService = await js.views.kv("states");
    logsKVService = await js.views.kv("logs");

    console.log(" 🎇🟢 Connected to NATS")

})().then(setup);

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

async function setup() {
    const done = await (async () => {
        for await (const msg of sub) {
            console.log("Message received: ");
            console.log(msg);

            let pmsg = JSON.parse(msg.string());
            console.log(pmsg)

            let userId = pmsg.user;
            let jobId = pmsg.jobId;

            // TODO: Validate the msg


            // Tell KV we are prepared, state PENDING
            let kvValue = await getKV(userId + "." + jobId);
            kvValue.state = "PENDING";
            await putKV(userId + "." + jobId, kvValue);
            console.log(" -> PENDING PHASE ")

            // Get the Blob from the Object Store
            let blob = await getBlob(jobId + "-input");
            let mimetype = pmsg?.image?.mimetype;

            // Tell the KV we are running, state RUNNING
            kvValue = await getKV(userId + "." + jobId);
            kvValue.state = "RUNNING";
            await putKV(userId + "." + jobId, kvValue);
            console.log(" -> RUNNING PHASE ")

            // Run the job
            let resBuffer = await execute_model(blob)

            // Store the Blob in the Object Store
            let blob_name = jobId + "-output";
            await storeBlob(blob_name, resBuffer);

            // Tell the KV we are done, state DONE
            kvValue = getKV(userId + "." + jobId);
            kvValue.state = "FINISHED";
            await putKV(userId + "." + jobId, "FINISHED");
            console.log(" --> FINISHED PROCESSING JOB [" + jobId +"]")
        }
    })();

    // const jets = nc.jetstream();
    // const kv = jets.kv("states");

    // await kv.put("user.*", "bar");

    // await kv.get("user.*")
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

    console.log("Running...")

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


    // create a new canvas and draw the detection and landmarks
    const out = faceapi.createCanvasFromMedia(img)
    faceapi.draw.drawDetections(out, results.map(res => res.detection))
    faceapi.draw.drawFaceLandmarks(out, results.map(res => res.landmarks), {drawLines: true, color: 'red'})
    faceapi.draw.drawFaceExpressions(out, results.map(res => res.expressions))


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
async function putKV(key, value) {
    // Store in NATS KV
    await statesKVService.put(key, JSON.stringify(value));
}

async function getKV(key) {
    // Get from NATS KV
    let entry = await statesKVService.get(key);
    console.log(`KV get Op: ${entry?.key} @ ${entry?.revision} -> ${entry?.string()}`);

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
    await putKV(key, exampleJson);
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

async function readBlobTest(){
    let blob_name = inputMsgExample.jobId + "-input";
    let blob = await getBlob(blob_name);
    console.log(blob);

    // Store in disk
    saveFile('test.jpg', blob)
}

// storeBlobTest()
// setup()