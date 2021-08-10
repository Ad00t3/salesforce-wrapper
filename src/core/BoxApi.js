const fs = require("fs");
const path = require("path");
const BoxSDK = require("box-node-sdk");
const crypto = require("crypto");
const env = require('dotenv').config();

const sdkConfig = require('../config/529616378_ko43ns10_config.json');
const sdk = BoxSDK.getPreconfiguredInstance(sdkConfig);

var client;
var dir;
var folder;
var errors;

// Connect to Box.com API & create folder
export async function initFolder(sessID, errorsP) {
    try {
        errors = errorsP;
        client = sdk.getAppAuthClient('user', '16850231633');
        dir = `out/${sessID}`;
        folder = await client.folders.create('0', sessID);
    } catch (e) {
        errors.push('box-init-failed');
        console.error(e);
    }
}

// Upload file to Box.com folder, returns sharing link
export async function upload(fileName) {
    try {
        const f = fs.readFileSync(path.join(dir, fileName));
        const preflight = await client.files.preflightUploadFile(folder.id, { name: fileName, size: f.length });
        console.log(preflight);
    
        var fileObj;
        if (f.length < 2000000) {
            const fileSha = crypto.createHash("sha1").update(f).digest("hex");
            client.setCustomHeader("content-md5", fileSha);
            console.log('a');
            fileObj = await client.files.uploadFile(folder.id, fileName, f);
          } else {
            client.setCustomHeader("content-md5", null);
            const uploader = await client.files.getChunkedUploader(folder.id, f.length, fileName, f);
            fileObj = await new Promise((resolve, reject) => {
                uploader.on("error", err => {
                    errors.push(err);
                    reject(err);
                });
                uploader.on("chunkUploaded", part => { console.log("Part uploaded..."); });
                uploader.on("uploadComplete", resolve);
                uploader.start();
            });
        }
        
        fileObj = await client.files.update(fileObj.entries[0].id, {
            shared_link: {
              access: client.accessLevels.DEFAULT,
              permissions: {
                can_download: true
              }
            }
        });
    
        console.log(fileObj);
        return fileObj.entries[0].shared_link;
    } catch (e) {
        errors.push(`box-upload-failed:${fileName}`);
        console.error(e);
    }
}