import { start } from 'repl';
import config from './config/config';

const fs = require('fs');
const { desktopCapturer } = require('electron');
const randstring = require('randomstring');

const recFormat = 'video/webm; codecs=vp9';
var screenRec, webcamRec;
const screenRecBlobs = [];
const webcamRecBlobs = [];

var sessID = '';
var patientName = '';
var sessData = {};

function resetSess() {
    const pjson = require('../package.json');
    sessID = '';
    patientName = '';
    sessData = {
        start_time: '',
        end_time: '',
        duration: 0,
        patient_ID: '',
        clinician_name: '',
        work_type: '',
        log_method: `${pjson.productName} v${pjson.version}`,
        clinician_IP: '',
        pdf_audit: '',
        video_audit: ''
    };
}

// When timer starts
export async function onStart(browser) {
    // Session init & get IDs
    resetSess();
    sessID = randstring.generate(10);
    patientName = await browser.executeJavaScript('document.querySelector("title").textContent');
    patientName = patientName.substring(0, patientName.indexOf('|')).trim();
    sessData.patient_ID = browser.getURL()
        .replace('https://assurehealth--hc.lightning.force.com/lightning/r/Account/', '')
        .replace('/view', '');

    // Screen recording setup
    const stream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:0:0' }}, audio: false });
    screenRec = new MediaRecorder(stream, { mimeType: recFormat });
    screenRec.ondataavailable = (e) => { screenRecBlobs.push(e.data); }
    screenRec.onstop = async (e) => {
        const blob = new Blob(screenRecBlobs, { type: recFormat });
        const buffer = await blob.arrayBuffer();
        fs.writeFileSync(`screenRec-${sessID}.webm`, Buffer.from(buffer));
    }

    // Webcam recording setup
    if (config.get('webcamRecording')) {
        const stream = await navigator.getUserMedia(
            { video: true, audio: false },
            (stream) => {
                webcamRec = new MediaRecorder(stream, { mimeType: recFormat });
                webcamRec.ondataavailable = (e) => { webcamRecBlobs.push(e.data); }
                webcamRec.onstop = async (e) => {
                    const blob = new Blob(webcamRecBlobs, { type: recFormat });
                    const buffer = await blob.arrayBuffer();
                    fs.writeFileSync(`webcamRec-${sessID}.webm`, Buffer.from(buffer));
                }
            },
            (error) => {
                console.error(error);
            }
        );
    }

    // Start recordings
    if (screenRec) screenRec.start();
    if (webcamRec) webcamRec.start();
    sessData.start_time = Date.now();
}

// When timer stopped
export function onStop() {
    // Stop recordings
    if (screenRec && screenRec.state === 'recording') {
        screenRec.stop();
        screenRec = null;
    }
    if (webcamRec && webcamRec.state === 'recording') {
        webcamRec.stop();
        webcamRec = null;
    }

    // End timing
    sessData.end_time = Date.now();
    sessData.duration = Math.round((sessData.end_time - sessData.start_time) / 1000.0);

    // Post-processing/combining videos
    

    // Generate audit log PDF


    // Connect to Box.com API


    // Create new Box.com folder


    // Upload video & audit log


    // Generate folder sharing link


    // Send JSON payload to salesforce endpoint
    console.log(sessData);

}