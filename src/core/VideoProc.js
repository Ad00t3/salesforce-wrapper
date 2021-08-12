import config from '../config/config';

const fs = require('fs-extra');
const path = require('path');
const { remote, desktopCapturer } = require('electron');
const { screen } = remote;
const VideoStreamMerger = require('video-stream-merger').VideoStreamMerger;
const child = require('child_process');

const ffmpegStatic = require('ffmpeg-static');
const li = ffmpegStatic.lastIndexOf('/');
const ffmpegPath = path.join(
    (remote.app.getAppPath() + '/../').replace('app.asar', 'app.asar.unpacked'),
    'node_modules/ffmpeg-static/',
    ffmpegStatic.substring((li === -1 ? ffmpegStatic.lastIndexOf('\\') : li) + 1)
);
console.log(ffmpegPath);

const recFormat = 'video/webm';
var merger, mergerRec;
var screenStream, webcamStream, canvasStream;
var mergerRecBlobs = [];

// Start streams & merger
export async function startStreams(sessID, sessData, errors, canvas) {
    merger = null; mergerRec = null;
    screenStream = null; webcamStream = null, canvasStream = null;
    mergerRecBlobs = [];

    try {
        const sWidth = config.get('rec.sWidth');
        const sHeight = config.get('rec.sHeight');
        const f = config.get('rec.f');

        const sDim = {
            x: 0,
            y: 0,
            width: sWidth,
            height: sHeight
        };
        const wDim = {
            x: sDim.width,
            y: 0,
            width: sDim.width / f,
            height: sDim.height / f
        };
        const iDim = {
            x: wDim.x,
            y: config.get('rec.useWebcam') ? wDim.height : 0,
            width: wDim.width,
            height: config.get('rec.useWebcam') ? sDim.height - wDim.height : sDim.height
        };

        merger = new VideoStreamMerger();
        merger.setOutputSize(sDim.width + wDim.width, sDim.height);

        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        const winID = sources.filter(win => win.name === config.get('title'))[0].id;
        const nScreen = winID.substring(winID.lastIndexOf(':') + 1, winID.length);
        
        screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: `screen:${nScreen || '0'}:0` }}, audio: false });
        merger.addStream(screenStream, { ...sDim, index: 0, mute: true });

        canvasStream = canvas.captureStream(25);
        merger.addStream(canvasStream, { ...iDim, index: 1, mute: true });

        if (config.get('useWebcam')) {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            merger.addStream(webcamStream, { ...wDim, index: 2, mute: true });
        }

        merger.start();

        mergerRec = new MediaRecorder(merger.result, { mimeType: recFormat });
        mergerRec.ondataavailable = (e) => { mergerRecBlobs.push(e.data); }
        mergerRec.onstop = async (e) => {
            try {
                if (merger) { 
                    merger.result.getTracks().forEach(track => track.stop());
                    merger.destroy(); 
                }
                if (screenStream) {
                    screenStream.getTracks().forEach(track => track.stop());
                    screenStream = null;
                }
                if (canvasStream) {
                    canvasStream.getTracks().forEach(track => track.stop());
                    canvasStream = null;
                }
                if (webcamStream) {
                    webcamStream.getTracks().forEach(track => track.stop());
                    webcamStream = null;
                }
    
                const webm = `out/${sessID}/video.webm`;
                const mp4 = `out/${sessID}/video.mp4`;
    
                const blob = new Blob(mergerRecBlobs, { type: recFormat });
                const buffer = await blob.arrayBuffer();
                fs.writeFileSync(webm, Buffer.from(buffer));
                child.execFileSync(ffmpegPath, [ '-fflags', '+genpts', '-i', webm, '-r', '25', mp4 ]);
                fs.removeSync(webm);
                mergerRec.dispatchEvent(new Event('writeDone'));
            } catch (ex) {
                errors.push('mergerRec-onstop-failed');
                console.error(ex);
            }
        }
    } catch (e) {
        console.error(e);
        errors.push('cant-record-session');
    }

    return mergerRec;
}