const fs = require('fs');
const path = require('path');

const configFP = './config.json';
var config = {};

(() => {
    if (fs.existsSync(configFP))
        config = JSON.parse(fs.readFileSync(configFP));
    else
        reset();
})();

function write() {
    fs.writeFileSync(configFP, JSON.stringify(config));
}

export function get(property) {
    return config[property];
}

export function set(key, value) {
    config[key] = value;
    write();
}

export function reset() {
    config = {
        webcamRecording: false
    };
    write();
}