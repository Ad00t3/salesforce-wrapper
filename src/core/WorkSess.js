import config from '../config/config';
import * as PDFGen from './PDFGen';
import * as API from './API';
import * as VideoProc from './VideoProc';

const fs = require('fs-extra');
const { desktopCapturer } = require('electron');
const randstring = require('randomstring');
const publicIp = require('public-ip');
const VideoStreamMerger = require('video-stream-merger').VideoStreamMerger;

const recFormat = 'video/webm; codecs=vp9';
var screenRec, webcamRec, mergerRec;
const screenRecBlobs = [], webcamRecBlobs = [], mergerRecBlobs = [];
var screenStream, webcamStream, merger;

var sessID = '';
var patientName = '';
var sessData = {};

async function resetSess() {
    sessID = '';
    patientName = '';

    const pjson = require('../../package.json');
    sessData = {
        start_time: '',
        end_time: '',
        duration: 0,
        patient_ID: '',
        clinician_name: '',
        work_type: '',
        log_method: `${pjson.productName} v${pjson.version}`,
        clinician_IP: (await publicIp.v4()),
        pdf_audit: '',
        video_audit: ''
    };
}

// When timer starts
export async function onStart(workType, browser) {
    // Session init
    const errors = [];
    await resetSess();
    sessID = randstring.generate(19);
    if (!fs.existsSync('out/'))
        fs.mkdirSync('out/');
    fs.mkdirSync(`out/${sessID}/`);

    // Initial information
    patientName = browser.getTitle();
    patientName = patientName.substring(0, patientName.indexOf('|')).trim();
    sessData.patient_ID = browser.getURL().replace('https://assurehealth--hc.lightning.force.com/lightning/r/Account/', '').replace('/view', '');
    sessData.work_type = workType;
    if (sessData.work_type === '')
        errors.push('invalid-activity-type');

    // Get clinician name
    await browser.executeJavaScript('document.querySelector("button.branding-userProfile-button").click()');
    while (sessData.clinician_name == null || sessData.clinician_name === '') {
        sessData.clinician_name = await browser.executeJavaScript(`
            (() => {
                let cardName = document.querySelector("h1.profile-card-name");
                if (cardName && cardName.textContent) 
                    return cardName.textContent;
                return "";
            })();
        `);
    }

    try {
        const cWidth = 1366, cHeight = 768,
              wWidth = 256, wHeight = 144;
        merger = new VideoStreamMerger();
        merger.setOutputSize(cWidth, cHeight);

        screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:0:0' }}, audio: false });
        merger.addStream(screenStream, { x: 0, y: 0, width: merger.width, height: merger.height, index: 0, mute: true });

        if (config.get('webcamRecording')) {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            merger.addStream(webcamStream, { x: merger.width - wWidth, y: 0, width: wWidth, height: wHeight, index: 1, mute: true });
        }

        merger.start();

        mergerRec = new MediaRecorder(merger.result, { mimeType: recFormat });
        mergerRec.ondataavailable = (e) => { mergerRecBlobs.push(e.data); }
        mergerRec.onstop = async (e) => {
            if (screenStream) screenStream.getTracks().forEach((track) => track.stop());
            if (webcamStream) webcamStream.getTracks().forEach((track) => track.stop());

            const blob = new Blob(mergerRecBlobs, { type: recFormat });
            const buffer = await blob.arrayBuffer();
            fs.writeFileSync(`out/${sessID}/video.webm`, Buffer.from(buffer));
        }
    } catch (e) {
        console.error(e);
        errors.push('cant-record-screen');
    }

    if (errors.length === 0) {
        if (mergerRec) mergerRec.start();
        sessData.start_time = new Date();
    } else {
        fs.remove(`out/${sessID}`);
    }

    // // Screen recording setup
    // try {
    //     screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:0:0' }}, audio: false });
    //     screenRec = new MediaRecorder(screenStream, { mimeType: recFormat });
    //     screenRec.ondataavailable = (e) => { screenRecBlobs.push(e.data); }
    //     screenRec.onstop = async (e) => {
    //         screenStream.getTracks().forEach((track) => track.stop());
    //         const blob = new Blob(screenRecBlobs, { type: recFormat });
    //         const buffer = await blob.arrayBuffer();
    //         fs.writeFileSync(`out/${sessID}/screen.webm`, Buffer.from(buffer));
    //     }
    // } catch (e) {
    //     console.error(e);
    //     errors.push('cant-record-screen');
    // }
    //
    // // Webcam recording setup
    // if (config.get('webcamRecording')) {
    //     try {
    //         webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    //         webcamRec = new MediaRecorder(webcamStream, { mimeType: recFormat });
    //         webcamRec.ondataavailable = (e) => { webcamRecBlobs.push(e.data); }
    //         webcamRec.onstop = async (e) => {
    //             webcamStream.getTracks().forEach((track) => track.stop());
    //             const blob = new Blob(webcamRecBlobs, { type: recFormat });
    //             const buffer = await blob.arrayBuffer();
    //             fs.writeFileSync(`out/${sessID}/webcam.webm`, Buffer.from(buffer));
    //         }
    //     } catch (e) {
    //         console.error(e);
    //         errors.push('cant-record-webcam');
    //     }
    // }
    //
    // // Start recordings
    // if (errors.length === 0) {
    //     if (screenRec) screenRec.start();
    //     if (webcamRec) webcamRec.start();
    //     sessData.start_time = new Date();
    // }
    return errors;
}


// When timer stopped
export async function onStop() {
    const errors = [];

    // Stop recordings
    // if (screenRec && screenRec.state === 'recording') {
    //     screenRec.stop();
    //     screenRec = null;
    // }
    // if (webcamRec && webcamRec.state === 'recording') {
    //     webcamRec.stop();
    //     webcamRec = null;
    // }
    if (mergerRec && mergerRec.state === 'recording') {
        mergerRec.stop();
        mergerRec = null;
    }
    screenStream = null, webcamStream = null, merger = null;

    // End timing
    sessData.end_time = new Date();
    sessData.duration = Math.round((sessData.end_time - sessData.start_time) / 1000.0);
    sessData.start_time = sessData.start_time.toLocaleString('en-US', { timeZone: 'America/New_York' });
    sessData.end_time = sessData.end_time.toLocaleString('en-US', { timeZone: 'America/New_York' });

    // Post-processing/combining videos
    // await VideoProc.process(sessID, sessData);

    // Send files to Box.com API
    API.initBox(sessID);
    sessData.video_audit = API.uploadToBox(`out/${sessID}/video.mp4`);
    await PDFGen.genAuditLog(sessID, patientName, sessData);
    sessData.pdf_audit = API.uploadToBox(`out/${sessID}/audit.pdf`);

    // Send JSON payload to salesforce endpoint (via AWS Lambda)
    console.log(sessData);

    // Wrap up
    // fs.remove(`out/${sessID}`);
    return errors;
}