import * as config from './config/config';

const fs = require('fs');
const { desktopCapturer } = require('electron');
const randstring = require('randomstring');

var sessionID = '';
const recFormat = 'video/webm; codecs=vp9';
var screenRec, webcamRec;
const screenRecBlobs = [];
const webcamRecBlobs = [];

function umOptions(source) {
    return {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
            }
        }
    };
}

// When timer started
export async function onStart() {
    // Session ID to be used for all session identification
    sessionID = randstring.generate(10);

    // Screen & webcam recording setup
    desktopCapturer.getSources({ types: ['window', 'screen'] })
        .then(async sources => {
            console.log(sources);
            for (const source of sources) {
                if (source.name === 'Entire Screen') {
                    // Create media stream & recorder
                    const stream = await navigator.mediaDevices.getUserMedia(umOptions(source));
                    screenRec = new MediaRecorder(stream, { mimeType: recFormat });
                    screenRec.ondataavailable = (e) => { screenRecBlobs.push(e.data); }
                    screenRec.onstop = async (e) => {
                        const blob = new Blob(screenRecBlobs, { type: recFormat });
                        const buffer = await blob.arrayBuffer();
                        fs.writeFileSync(`screenRec-${sessionID}.webm`, Buffer.from(buffer));
                    }
                } else if (config.get('webcamRecording') && source.name === 'webcam') { 
                    const stream = await navigator.mediaDevices.getUserMedia(umOptions(source));
                    webcamRec = new MediaRecorder(stream, { mimeType: recFormat });
                    webcamRec.ondataavailable = (e) => { webcamRecBlobs.push(e.data); }
                    webcamRec.onstop = async (e) => {
                        const blob = new Blob(webcamRecBlobs, { type: recFormat });
                        const buffer = await blob.arrayBuffer();
                        fs.writeFileSync(`webcamRec-${sessionID}.webm`, Buffer.from(buffer));
                    }
                }
            }
        })
        .finally(() => {
            // Start recordings
            if (screenRec) screenRec.start();
            if (webcamRec) webcamRec.start();
        });
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

    // Post-processing/combining videos
    

    // Generate audit log PDF


    // Connect to Box.com API


    // Create new Box.com folder


    // Upload video & audit log


    // Generate folder sharing link


    // Send JSON payload to salesforce endpoint

}