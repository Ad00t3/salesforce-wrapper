import config from '../config/config';

const fs = require('fs-extra');
const path = require('path');
const { remote, desktopCapturer } = require('electron');
const VideoStreamMerger = require('video-stream-merger').VideoStreamMerger;
const child = require('child_process');
const { Readable, Writable } = require('stream');

// Check ffmpeg & ffprobe installations
try {
    console.log(child.execFileSync(config.get('ffmpegPath'), [ '-version' ]).toString());
    console.log(child.execFileSync(config.get('ffprobePath'), [ '-version' ]).toString());
} catch (e) {
    console.error('ffmpeg/ffprobe not found: ' + e);
}

// Start streams & merger
export async function startStreams(session, pSess, errors, canvas) {
    var merger = null, mergerRec = null;
    var screenStream = null, webcamStream = null, canvasStream = null;
    var mergerRecBlobs = [];
    var isStopped = false;

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
        var totalWidth = sDim.width + wDim.width;
        if (totalWidth % 2 !== 0) totalWidth++;
        merger.setOutputSize(totalWidth, sDim.height);
        
        screenStream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:0:0' }}, audio: false });
        merger.addStream(screenStream, { ...sDim, index: 0, mute: true });

        canvasStream = canvas.captureStream(25);
        merger.addStream(canvasStream, { ...iDim, index: 1, mute: true });

        if (config.get('useWebcam')) {
            webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            merger.addStream(webcamStream, { ...wDim, index: 2, mute: true });
        }

        merger.start();

        var vI = 0;
        var webm = pSess(`video-${vI}.webm`);
        var mp4 = pSess('video.mp4');    
        while (fs.existsSync(webm)) {
            webm = pSess(`video-${++vI}.webm`);
        }

        mergerRec = new MediaRecorder(merger.result, { mimeType: 'video/webm;codecs=vp9' });
        mergerRec.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                e.data.arrayBuffer().then(buffer => {
                    fs.outputFileSync(webm, Buffer.from(buffer), { flag: 'a' });
                    if (isStopped)
                        mergerRec.dispatchEvent(new Event('lastBlobWritten'));
                });
            }
        }
        mergerRec.onstop = e => {
            isStopped = true;

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

                mergerRec.addEventListener('lastBlobWritten', () => {
                    try {
                        // Remove video.webm (redundancy)
                        webm = pSess('video.webm');
                        fs.removeSync(webm);

                        // Create concat list && concat webms
                        var concatList = '';
                        fs.readdirSync(pSess())
                            .filter(fileName => fileName.endsWith('webm'))
                            .forEach(webmFileName => concatList += `file '${pSess(webmFileName)}'\n`);
                        const concatListFp = pSess('concatList.txt');
                        fs.writeFileSync(concatListFp, concatList);
                        child.execFileSync(config.get('ffmpegPath'), [ '-safe', '0', '-f', 'concat', '-i', concatListFp, '-c', 'copy', webm]);

                        // Convert to mp4 & move on
                        fs.removeSync(mp4);
                        child.execFileSync(config.get('ffmpegPath'), [ '-fflags', '+genpts', '-i', webm, '-r', '25', mp4 ]);
                        mergerRec.dispatchEvent(new Event('writeDone'));
                    } catch (ex) {
                        errors.push('lastBlobWritten-failed');
                        console.error(ex);
                    }
                });
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

export function getVideoDuration(filePath, errors) {
    try {
        return parseFloat(child.execFileSync(config.get('ffprobePath'), [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath ]));
    } catch (e) {
        errors.push('ffprobe-failed');
        console.error(e);
    }
}

