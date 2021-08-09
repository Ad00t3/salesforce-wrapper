import { PDFDocument, StandardFonts } from 'pdf-lib';
import config from './config/config';

const fs = require('fs');
const { desktopCapturer } = require('electron');
const randstring = require('randomstring');
const publicIp = require('public-ip');

const recFormat = 'video/webm; codecs=vp9';
var screenRec, webcamRec;
const screenRecBlobs = [];
const webcamRecBlobs = [];

var sessID = '';
var patientName = '';
var sessData = {};

async function resetSess() {
    sessID = '';
    patientName = '';

    const pjson = require('../package.json');
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

    // Screen recording setup
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'screen:0:0' }}, audio: false });
        screenRec = new MediaRecorder(stream, { mimeType: recFormat });
        screenRec.ondataavailable = (e) => { screenRecBlobs.push(e.data); }
        screenRec.onstop = async (e) => {
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(screenRecBlobs, { type: recFormat });
            const buffer = await blob.arrayBuffer();
            fs.writeFileSync(`out/${sessID}/screen.webm`, Buffer.from(buffer));
        }
    } catch (e) {
        console.error(e);
        errors.push('cant-record-screen');
    }

    // Webcam recording setup
    if (config.get('webcamRecording')) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            webcamRec = new MediaRecorder(stream, { mimeType: recFormat });
            webcamRec.ondataavailable = (e) => { webcamRecBlobs.push(e.data); }
            webcamRec.onstop = async (e) => {
                stream.getTracks().forEach((track) => track.stop());
                const blob = new Blob(webcamRecBlobs, { type: recFormat });
                const buffer = await blob.arrayBuffer();
                fs.writeFileSync(`out/${sessID}/webcam.webm`, Buffer.from(buffer));
            }
        } catch (e) {
            console.error(e);
            errors.push('cant-record-webcam');
        }
    }

    // Start recordings
    if (errors.length === 0) {
        if (screenRec) screenRec.start();
        if (webcamRec) webcamRec.start();
        sessData.start_time = new Date();
    }
    return errors;
}

// Generate audit log PDF
var pdfY;
async function genAuditLog() {
    const pdf = await PDFDocument.create();

    const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const times = await pdf.embedFont(StandardFonts.TimesRoman);
    const courierBold = await pdf.embedFont(StandardFonts.CourierBold);

    const page = pdf.addPage();
    const { width, height } = page.getSize();
    const f1 = 15, 
          f2 = 12, 
          f3 = 10;
    const ls1 = f2 * 1.5, 
          ls2 = f2 * 3.5,
          ls3 = f3 * 1.2;
    const pdfX = 72;
    pdfY = height - pdfX;

    page.drawText('Work Session Time Audit Log', { x: pdfX, y: pdfY, size: 16, font: timesBold, size: f1 }); pdfY -= ls1;
    page.drawText('Remote Patient Monitoring Clinical Work', { x: pdfX, y: pdfY, size: 16, font: timesBold, size: f1 }); pdfY -= ls2;

    page.drawText(`Patient Name: ${patientName}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
    const split = sessData.clinician_name.split(' ');
    page.drawText(`Care Manager: ${split[1]}, ${split[0]}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
    page.drawText(`Activity Type: ${sessData.work_type}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    page.drawText(`Time Logged By: ${sessData.clinician_name}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
    page.drawText(`IP Address: ${sessData.clinician_IP}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
    page.drawText(`Audit Software Version: ${sessData.log_method}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    const startSplit = sessData.start_time.split(', ');
    const endSplit = sessData.end_time.split(', ');
    page.drawText(`Date of Work Session: ${startSplit[0]}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
    page.drawText(`Work Session ID: ${sessID}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    const hours = Math.floor(sessData.duration / 3600);
    const minutes = Math.floor((sessData.duration % 3600) / 60);
    const seconds = sessData.duration % 60;
    const durationStr = `${hours} hr, ${minutes} min, ${seconds} sec`;
    page.drawText(`Total Duration of Work Session: ${durationStr}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    page.drawText(`Video Audit Log: ${sessData.video_audit}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    page.drawText('AUDIT LOG:', { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    page.drawText(`${startSplit[1]} EDT to ${endSplit[1]} EDT (${durationStr})`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    page.drawText('Screen Recording?       YES', { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls1;
    page.drawText(`Webcam Recording?    ${config.get('webcamRecording') ? 'YES' : 'NO'}`, { x: pdfX, y: pdfY, font: times, size: f2 }); pdfY -= ls2;

    const nowSplit = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }).split(', ');
    page.drawText(`This work session time audit log was programmatically generated, without`, { x: pdfX, y: pdfY, font: timesBold, size: f3 }); pdfY -= ls3;
    page.drawText(`human intervention, by tamper-proof software on ${nowSplit[0]} at ${nowSplit[1]} EDT`, { x: pdfX, y: pdfY, font: timesBold, size: f3 });

    fs.writeFileSync(`out/${sessID}/audit.pdf`, await pdf.save());
}

// When timer stopped
export async function onStop() {
    const errors = [];

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
    sessData.end_time = new Date();
    sessData.duration = Math.round((sessData.end_time - sessData.start_time) / 1000.0);
    sessData.start_time = sessData.start_time.toLocaleString('en-US', { timeZone: 'America/New_York' });
    sessData.end_time = sessData.end_time.toLocaleString('en-US', { timeZone: 'America/New_York' });

    // Post-processing/combining videos
    

    // Connect to Box.com API


    // Create new Box.com folder


    // Upload video log


    sessData.video_audit = 'google.com';
    await genAuditLog();


    // Send JSON payload to salesforce endpoint
    console.log(sessData);

    return errors;
}