import config from '../config/config';
import * as PDFGen from './PDFGen';
import * as API from './API';
import * as VideoProc from './VideoProc';

const fs = require('fs-extra');
const randstring = require('randomstring');
const publicIp = require('public-ip');

var mergerRec;

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
export async function onStart(workType, browser, canvas) {
    // Session init
    const errors = [];
    await resetSess();
    sessID = randstring.generate(16);
    if (!fs.existsSync('out/')) fs.mkdirSync('out/');
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

    // Start streams & recording
    mergerRec = await VideoProc.startStreams(sessID, sessData, errors, canvas);
    if (errors.length === 0) {
        if (mergerRec) mergerRec.start();
        sessData.start_time = new Date();
    } else {
        fs.removeSync(`out/${sessID}`);
    }
    return errors;
}


// When timer stopped
export async function onStop() {
    // End recording
    const errors = [];
    if (mergerRec && mergerRec.state === 'recording') {
        mergerRec.stop();
        mergerRec = null;
    }

    // End timing
    sessData.end_time = new Date();
    sessData.duration = Math.round((sessData.end_time - sessData.start_time) / 1000.0);
    sessData.start_time = sessData.start_time.toLocaleString('en-US', { timeZone: 'America/New_York' });
    sessData.end_time = sessData.end_time.toLocaleString('en-US', { timeZone: 'America/New_York' });

    // Send files to Box.com API
    API.initBox(sessID);
    sessData.video_audit = API.uploadToBox(`out/${sessID}/video.webm`);
    await PDFGen.genAuditLog(sessID, patientName, sessData);
    sessData.pdf_audit = API.uploadToBox(`out/${sessID}/audit.pdf`);

    // Send JSON payload to salesforce endpoint (via AWS Lambda)
    console.log(sessData);

    // Wrap up
    // fs.removeSync(`out/${sessID}`);
    return errors;
}