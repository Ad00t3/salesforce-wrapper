const fs = require("fs");
const path = require("path");
const BoxSDK = require("box-node-sdk");
const crypto = require("crypto");
const env = require('dotenv').config();

const sdk = new BoxSDK({
    clientID: 'hkbtd0ccdyi0xayz0tdlygurybjn6ddh',
    clientSecret: 'KFLBq3bSDtEIg5uiIyVaYekA2oNDELCh'
});

var client;
var dir;
var folder;
var errors;

// Connect to Box.com API & create folder
export async function initFolder(sessID) {
    client = sdk.getBasicClient('j0ecivtJ5UYfZBoGaNYMGJ5VJpEHaqvr');
    dir = `out/${sessID}`;
    folder = await client.folders.create('142933730580', sessID);
}

// Upload file to Box.com folder, returns sharing link
export async function upload(fileName) {
    const stream = fs.createReadStream(path.join(dir, fileName));
    const fileObj = await client.files.uploadFile(folder.id, fileName, stream);
    console.log(fileObj);
    return fileObj.entries[0].shared_link;
}