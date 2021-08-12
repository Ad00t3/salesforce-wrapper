const Store = require('electron-store');

const config = new Store({
  schema: {
    title: { type: 'string' },
    workTypes: { 
      type: 'array',
      items: { type: 'string' }
    },
    rec: {
      type: 'object',
      properties: {
        useWebcam: { type: 'boolean' },
        sWidth: { type: 'number' },
        sHeight: { type: 'number' },
        f: { type: 'number' }
      }
    }
  },
  defaults: {
    title: '',
    workTypes: [],
    rec: {
      useWebcam: false,
      sWidth: 1280,
      sHeight: 720,
      f: 3.5
    }
  }
});

const pjson = require('../../package.json');
config.set('title', `${pjson.productName} v${pjson.version}`);

export default config; 