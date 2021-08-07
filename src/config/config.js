const Store = require('electron-store');

const config = new Store({
  schema: {
    webcamRecording: { type: 'boolean', default: false },
    workTypes: { 
      type: 'array',
      items: { type: 'string' },
      default: [ 'a', 'b', 'c' ]
    }
  }
});

export default config; 