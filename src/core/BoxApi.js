const fs = require('fs');
const path = require('path');
const BoxSDK = require('box-node-sdk');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const randstring = require('randomstring');

const boxConfig = require('../config/529616378_en3h9wn8_config.json');
const authURL = 'https://api.box.com/oauth2/token';
const userID = '16850231633';
const sdk = BoxSDK.getPreconfiguredInstance(boxConfig);

var client;
var dir;
var folder;
var errors;

// Connect to Box.com API & create folder
export async function initFolder(sessID, errorsP) {
    try {
        errors = errorsP;

        // const assertion = jwt.sign({
        //     iss: boxConfig.boxAppSettings.clientID,
        //     sub: userID,
        //     box_sub_type: 'user',
        //     aud: authURL,
        //     jti: crypto.randomBytes(64).toString('hex'),
        //     exp: Math.floor(Date.now() / 1000) + 45
        // }, {
        //     key: boxConfig.boxAppSettings.appAuth.privateKey,
        //     passphrase: boxConfig.boxAppSettings.appAuth.passphrase
        // }, {
        //     'algorithm': 'RS384',
        //     'keyid': boxConfig.boxAppSettings.appAuth.publicKeyID,
        // });

        // const accessToken = (await fetch(authURL, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/x-www-form-urlencoded'
        //     },
        //     body: JSON.stringify({
        //         grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        //         assertion: assertion,
        //         client_id: boxConfig.boxAppSettings.clientID,
        //         client_secret: boxConfig.boxAppSettings.clientSecret
        //     })
        // }));
        // console.log(accessToken);

        // let data = (await axios.get(
        //     'https://api.box.com/2.0/folders/142933730580', {
        //     headers: { 'Authorization' : `Bearer ${accessToken}` }
        // })).data;
        // console.log(data)
        
        

        client = sdk.getAppAuthClient('user', userID);
        dir = `out/${sessID}`;
        folder = await client.folders.create('142933730580', sessID);
    } catch (e) {
        errors.push('box-init-failed');
        console.error(e);
    }
}

// Upload file to Box.com folder, returns sharing link
export async function upload(fileName) {
    try {
        var fileObj;
        const accessToken = await client._session.getAccessToken(client._tokenOptions);
        const f = fs.readFileSync(path.join(dir, fileName));

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