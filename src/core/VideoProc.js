import config from '../config/config';

const fs = require('fs-extra');
const { screen } = require('electron').remote;
const VideoStreamMerger = require('video-stream-merger').VideoStreamMerger;

const recFormat = 'video/webm; codecs=vp9';
var merger, mergerRec;
var screenStream, webcamStream;
var mergerRecBlobs = [];

// Start streams & merger
export async function startStreams(sessID, sessData, errors) {
    merger = null; mergerRec = null;
    screenStream = null; webcamStream = null;
    mergerRecBlobs = [];

    try {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const factor = 4;
        const wWidth = width / factor, wHeight = height / factor;
        merger = new VideoStreamMerger();
        merger.setOutputSize(width, height);

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
            if (merger) { 
                merger.result.getTracks().forEach((track) => track.stop());
                merger.destroy(); 
            }
            if (screenStream) {
                screenStream.getTracks().forEach((track) => track.stop());
                screenStream = null;
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