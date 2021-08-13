import config from '../config/config';
import * as PDFGen from './PDFGen';
import * as BoxApi from './BoxApi';
import * as VideoProc from './VideoProc';
import * as Lambda from './Lambda';

const fs = require('fs-extra');
const path = require('path');
const randstring = require('randomstring');
const publicIp = require('public-ip');
const { remote } = require('electron');
const app = remote.app;

var mergerRec;
var session = {};
var errors = [];

const pOut = p => path.join(app.getPath('userData'), 'out', p || '');
const pSess = fileName => path.join(pOut(session.id), fileName || '');

async function resetSession() {
    session = {
        id: '',
        patientName: '',
        payload: {
            start_time: '',
            end_time: '',
            duration: 0,
            patient_ID: '',
            clinician_name: '',
            work_type: '',
            log_method: config.get('title'),
            clinician_IP: (await publicIp.v4()),
            pdf_audit: '',
            video_audit: ''
        },
        p: {
            out: pOut,
            sess: pSess
        }
    }
}

// When timer starts
export async function onStart(workType, browser, canvas, cacheCB) {
    // Reset
    errors = [];
    await resetSession();
    var isNewSession = true;

    // Check if there's a cached session
    const foldersInOut = fs.existsSync(pOut()) ? fs.readdirSync(pOut(), { withFileTypes: true })
                            .filter(dirent => dirent.isDirectory())
                            .map(dirent => dirent.name) : [];
    if (foldersInOut.length > 0)
        isNewSession = await cacheCB();

    if (isNewSession) {
        // Generate new session
        session.id = randstring.generate(16);
        fs.removeSync(pOut());
        fs.mkdirSync(pSess(), { recursive: true });

        // Initial information
        session.patientName = browser.getTitle();
        session.patientName = session.patientName.substring(0, session.patientName.indexOf('|')).trim();
        const pURL = browser.getURL();
        session.payload.patient_ID = pURL.replace('https://assurehealth--hc.lightning.force.com/lightning/r/Account/', '').replace('/view', '');
        session.payload.work_type = workType;
        if (session.payload.work_type === '')
            errors.push('invalid-activity-type');

        // Get clinician name
        // await browser.loadURL('https://assurehealth--hc.lightning.force.com/lightning/settings/personal/PersonalInformation/home');
        // while (true) {
        //     session.payload.clinician_name = await browser.executeJavaScript(`
        //         (() => {
        //             setTimeout(() => {
        //                 return [...document.querySelectorAll("input")].length;
        //             }, 1000);
        //         })();
        //     `);
        //     console.log(session.payload.clinician_name);
        // }   
        // await browser.loadURL(pURL);

        await browser.executeJavaScript('document.querySelector("button.branding-userProfile-button").click();');
        while (session.payload.clinician_name === '') {
            session.payload.clinician_name = await browser.executeJavaScript(`
                (() => {
                    const nameCard = document.querySelector("h1.profile-card-name");
                    if (nameCard && nameCard.textContent) return nameCard.textContent;
                    return "";
                })();
            `);
        }

        session.payload.start_time = new Date();
        fs.writeFileSync(pSess('session.json'), JSON.stringify(session));
    } else {
        session = fs.readFileSync(path.join(pOut(), foldersInOut[0], 'session.json'));
    }

    // Start streams & recording
    mergerRec = await VideoProc.startStreams(session, errors, canvas);
    if (errors.length === 0) {
        if (mergerRec) mergerRec.start(1000);
    } else {
        fs.removeSync(pSess());
    }
    return { errors: errors,  session: session };
}


// When timer stopped
export function onStop() {
    // End timing
    errors = [];
    session.payload.end_time = new Date();
    session.payload.duration = Math.round(( session.payload.end_time -  session.payload.start_time) / 1000.0);
    session.payload.start_time =  session.payload.start_time.toLocaleString('en-US', { timeZone: 'America/New_York' });
    session.payload.end_time =  session.payload.end_time.toLocaleString('en-US', { timeZone: 'America/New_York' });

    // End recording
    if (mergerRec && mergerRec.state === 'recording')
        mergerRec.stop();
    
    return new Promise((resolve, reject) => {
        mergerRec.addEventListener('writeDone', async (e) => {
            // Send files to Box.com API
            await BoxApi.initFolder(session, errors);
            session.payload.video_audit = (await BoxApi.upload('video.mp4')) || '';
            await PDFGen.genAuditLog(session);
            session.payload.pdf_audit = (await BoxApi.upload('audit.pdf')) || '';

            if (errors.length === 0) {
                fs.removeSync(pSess());
                Lambda.sendToSalesforceWrapperRouter(session.payload, errors);
            }
            
            // Wrap up
            mergerRec = null;
            console.log(session);
            await resetSession();
            resolve({ errors: errors });
        });
    });
}