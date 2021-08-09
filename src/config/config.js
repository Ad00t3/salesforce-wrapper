const Store = require('electron-store');

const config = new Store({
  schema: {
    webcamRecording: { type: 'boolean', default: false },
    workTypes: { 
      type: 'array',
      items: { type: 'string' },
    }
  }
});

export default config; 