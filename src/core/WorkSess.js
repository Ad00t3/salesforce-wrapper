import config from '../config/config';
import * as util from '../util/util';
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
var foldersInOut = [];

const pOut = p => path.join(app.getPath('userData'), 'out', p || '');
const pSess = fileName => path.join(pOut(session.id), fileName || '');

// Check if there's a cached session
export function checkCache() {
    foldersInOut = fs.existsSync(pOut()) ? fs.readdirSync(pOut(), { withFileTypes: true })
                            .filter(dirent => dirent.isDirectory())
                            .map(dirent => dirent.name) : [];
    return (foldersInOut.length > 0);
}

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
        }
    }
}

// When timer starts
export async function onStart(workType, browser, canvas, isNewSession) {
    // Reset
    errors = [];
    await resetSession();

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
    } else {
        // Read session from cache
        session = JSON.parse(fs.readFileSync(path.join(pOut(), foldersInOut[0], 'session.json')));
    }

    // Start streams & recording
    mergerRec = await VideoProc.startStreams(session, pSess, errors, canvas);
    if (errors.length === 0) {
        if (mergerRec) mergerRec.start(1000);
        if (isNewSession) {
            // Write session to cache
            session.payload.start_time = util.toEST(new Date());
            fs.writeFileSync(pSess('session.json'), JSON.stringify(session));
        }
    } else {
        fs.removeSync(pSess());
    }
    return { errors: errors, session: session };
}


// When timer stopped
export function onStop() {
    // End timing & recording
    errors = [];
    session.payload.end_time = util.toEST(new Date());
    if (mergerRec && mergerRec.state === 'recording')
        mergerRec.stop();
    
    return new Promise((resolve, reject) => {
        mergerRec.addEventListener('writeDone', async (e) => {
            // Get duration from mp4
            session.payload.duration = Math.round(VideoProc.getVideoDuration(pSess('video.mp4'), errors));

            // Send files to Box.com API
            await BoxApi.initFolder(session, errors);
            session.payload.video_audit = (await BoxApi.upload(pSess('video.mp4'))) || '';
            await PDFGen.genAuditLog(session, pSess);
            session.payload.pdf_audit = (await BoxApi.upload(pSess('audit.pdf'))) || '';
            
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