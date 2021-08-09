import config from '../config/config';

const fs = require('fs');
const path = require('path');
const util = require('util');

export async function process(sessID, sessData) {
    const screenFP = `out/${sessID}/screen.webm`;
    const webcamFP = `out/${sessID}/webcam.webm`;

}