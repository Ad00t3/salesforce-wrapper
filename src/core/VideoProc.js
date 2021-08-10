import config from '../config/config';

const fs = require('fs-extra');
const { screen } = require('electron').remote;
const VideoStreamMerger = require('video-stream-merger').VideoStreamMerger;

const recFormat = 'video/webm; codecs=vp9';
var merger, mergerRec;
var screenStream, webcamStream, canvasStream;
var mergerRecBlobs = [];

// Start streams & merger
export async function startStreams(sessID, sessData, errors, canvas) {
    merger = null; mergerRec = null;
    screenStream = null; webcamStream = null, canvasStream = null;
    mergerRecBlobs = [];

    try {
        const sDim = {
            x: 0,
            y: 0,
            width: 1280,
            height: 720
        };
        const f = 3.5;
        const wDim = {
            x: sDim.width,
            y: 0,
            width: sDim.width / f,
            height: sDim.height / f
        };
        const iDim = {
            x: wDim.x,
            y: config.get('webcamRecording') ? wDim.height : 0,
            width: wDim.width,
            height: config.get('webcamRecording') ? sDim.height - wDim.height : sDim.height

        };
        merger = new VideoStreamMerger();
        merger.setOutputSize(sDim.width + wDim.width, sDim.height);

        screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:0:0' }}, audio: false });
        merger.addStream(screenStream, { ...sDim, index: 0, mute: true });

        canvasStream = canvas.captureStream(25);
        merger.addStream(canvasStream, { ...iDim, index: 1, mute: true });

        if (config.get('webcamRecording')) {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            merger.addStream(webcamStream, { ...wDim, index: 2, mute: true });
        }

        merger.start();

        mergerRec = new MediaRecorder(merger.result, { mimeType: recFormat });
        mergerRec.ondataavailable = (e) => { mergerRecBlobs.push(e.data); }
        mergerRec.onstop = async (e) => {
            if (merger) { 
                merger.result.getTracks().forEach((track) => track.stop());
                merger.destroy(); 
            }
            if (screenStream) {
                screenStream.getTracks().forEach((track) => track.stop());
                screenStream = null;
            }
            if (canvasStream) {
                canvasStream.getTracks().forEach((track) => track.stop());
                canvasStream = null;
            }
            if (webcamStream) {
                webcamStream.getTracks().forEach((track) => track.stop());
                webcamStream = null;
            }

            const blob = new Blob(mergerRecBlobs, { type: recFormat });
            const buffer = await blob.arrayBuffer();
            fs.writeFileSync(`out/${sessID}/video.webm`, Buffer.from(buffer));
        }
    } catch (e) {
        console.error(e);
        errors.push('cant-record-session');
    }

    return mergerRec;
}