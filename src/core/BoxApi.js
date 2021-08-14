const fs = require('fs');
const path = require('path');
const BoxSDK = require('box-node-sdk');
const crypto = require('crypto');
const randstring = require('randomstring');

const boxConfig = require('../config/529616378_en3h9wn8_config.json');
const sdk = BoxSDK.getPreconfiguredInstance(boxConfig);

var errors;
var session;
var client;
var folder;

// Connect to Box.com API & create folder
export async function initFolder(sessionP, errorsP) {
    try {
        errors = errorsP;
        session = sessionP;
        client = sdk.getAppAuthClient('user', '16850231633');
        folder = await client.folders.create('142933730580', session.payload.worksession_id);
    } catch (e) {
        errors.push('box-init-failed');
        console.error(e);
    }
}

// Upload file to Box.com folder, returns sharing link
export async function upload(filePath) {
    const fileName = path.basename(filePath);
    try {
        var fileObj;
        const accessToken = await client._session.getAccessToken(client._tokenOptions);
        const f = fs.readFileSync(filePath);

        if (f.length < 20000000) {
            const formData = new FormData();
            formData.append('attributes', JSON.stringify({
                name: fileName,
                parent: {
                    id: folder.id
                }
            }));
            formData.append('file', new Blob([f]), fileName);

            fileObj = await fetch('https://upload.box.com/api/2.0/files/content', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'content-md5': crypto.createHash('sha1').update(f).digest('hex')
                }, 
                body: formData
            })
            .then(res => res.json());
        } else {
            const uploader = await client.files.getChunkedUploader(folder.id, f.length, fileName, f);
            fileObj = await new Promise((resolve, reject) => {
                uploader.on('error', err => reject);
                uploader.on('chunkUploaded', part => { });
                uploader.on('uploadComplete', resolve);
                uploader.start();
            });
        }

        return (await client.files.update(fileObj.entries[0].id, {
            shared_link: { }
        })).shared_link.url;
    } catch (e) {
        errors.push(`box-upload-failed:${fileName}`);
        console.error(e);
    }
}