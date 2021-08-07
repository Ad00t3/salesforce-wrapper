import React, { useState, useEffect, useRef } from 'react';

import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Grid from '@material-ui/core/Grid';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';
import Modal from '@material-ui/core/Modal';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';

import PlayArrow from '@material-ui/icons/PlayArrow';
import Stop from '@material-ui/icons/Stop';
import Settings from '@material-ui/icons/Settings';

import { makeStyles } from '@material-ui/core/styles';
import * as colors from '@material-ui/core/colors';

import Timer from 'react-compound-timer';
import WebView from 'react-electron-web-view';
import * as WorkSess from '../WorkSess';
import config from '../config/config';

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

function ConfigMenu({}) {
  const [state, setState] = useState({
    webcamRecording: config.get('webcamRecording')
  });

  const handleFormToggle = (event) => {
    setState({ ...state, [event.target.name]: event.target.checked });
    config.set(event.target.name, event.target.checked)
  };

  return (
    <Card>
      <CardContent>
        <h1 style={{ textAlign: 'center' }}>Settings</h1>
        <br />
        <FormControlLabel
          control={<Switch checked={state.webcamRecording} onChange={handleFormToggle} name="webcamRecording" />}
          label="Record Webcam"
        />
      </CardContent>
    </Card>
  );
}

function WorkTypeComboBox() {
  const [value, setValue] = React.useState('');

  const filter = createFilterOptions();

  return (
    <Autocomplete
      value={value}
      onChange={(event, newValue) => {
        if (newValue) {
          if (newValue.inputValue) {
            setValue(newValue.inputValue);  
            config.set('workTypes', [ ...config.get('workTypes'), newValue.inputValue ]);
          } else {
            setValue(newValue);
          }
        }
      }}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);
        // Suggest the creation of a new value
        if (params.inputValue !== '') {
          filtered.push({
            inputValue: params.inputValue,
            title: `Add "${params.inputValue}"`,
          });
        }
        return filtered;
      }}
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      options={config.get('workTypes')}
      getOptionLabel={(option) => {
        // Value selected with enter, right from the input
        if (typeof option === 'string')
          return option;
        // Add "xxx" option created dynamically
        if (option.inputValue)
          return option.inputValue;
        // Regular option
        return option.title;
      }}
      renderOption={(option) => option.title || option}
      style={{ width: 300 }}
      freeSolo
      renderInput={(params) => (
        <TextField {...params} label="Activity Types" variant="outlined" />
      )}
    />
  );
}

export default function MainView({}) {
  const [isStarted, setIsStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [configOpen, setConfigOpen] = useState(false);

  var browser = null;

  function raiseError(msg) {
    const split = msg.split(' ');
    let wc = 0;
    for (let i = 0; i < split.length; i++) {
      if (wc++ === 10) {
        split.splice(i, 0, '\n');
        wc = 0;
      }
    }
    setErrorMsg(split.join(' '));
  }

  function hErrorClose(e, r) {
    if (r !== 'clickaway') 
      raiseError('');
  }

  async function toggleWorkSess(start, stop, reset) {
    raiseError('');
    let success = false;
    
    if (isStarted) {
      stop();
      WorkSess.onStop();
      reset();
      success = true;
    } else {
      if (browser.getURL().startsWith('https://assurehealth--hc.lightning.force.com/lightning/r/Account/')) {
        start();
        await WorkSess.onStart(browser);
        success = true;
      } else {
        raiseError('A work session may only be started on a patient account page. Please navigate to one.');
      }
    }

    if (success)
      setIsStarted(!isStarted);
  }

  return (
    <div>
      <AppBar color='default'>
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            margin: 'auto',
            padding: '0.75em 0',
          }}
        >
          <Toolbar>
            <Timer startImmediately={false}>
              {({ start, resume, pause, stop, reset, timerState }) => (
                <React.Fragment>
                  <Grid
                    container
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    spacing={4}
                  >
                    <Grid item>
                      <Snackbar 
                        open={errorMsg !== ''} 
                        autoHideDuration={4000} 
                        onClose={hErrorClose}
                        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                        key="topleft"
                      >
                        <Alert onClose={hErrorClose} severity="error" style={{ whiteSpace: 'pre-line' }}>
                          { errorMsg }
                        </Alert>
                      </Snackbar>
                    </Grid>
                    <Grid item>
                      <div style={{ fontSize: 30 }}>
                        <Timer.Days />d <Timer.Hours />h <Timer.Minutes />m <Timer.Seconds />s
                      </div>
                    </Grid>
                    <Grid item>
                      <IconButton 
                        variant="contained" 
                        style={{ backgroundColor: (isStarted ? colors.red[400] : colors.green[400]) }}
                        onClick={async () => { await toggleWorkSess(start, stop, reset); }}
                      >
                        { isStarted ? <Stop /> : <PlayArrow /> }
                      </IconButton>
                    </Grid>
                    <Grid item>
                      <WorkTypeComboBox />
                    </Grid>
                    <Grid item>
                      <IconButton 
                        onClick={() => { setConfigOpen(true); }}
                      >
                        <Settings />
                      </IconButton>
                      <Modal
                        open={configOpen}
                        onClose={() => { setConfigOpen(false); }}
                        aria-labelledby="simple-modal-title"
                        aria-describedby="simple-modal-description"
                      >
                        <div><ConfigMenu /></div>
                      </Modal>
                    </Grid>
                  </Grid>
                </React.Fragment>
              )}
            </Timer>
          </Toolbar>
        </div>
      </AppBar>
      <WebView 
        src={'https://assurehealth--hc.my.salesforce.com/'}
        enableremotemodule="true"
        style={{ 
          display: 'grid',
          position: 'absolute',
          left: '-8px',
          top: '85px',
          width: '100vw',
          height: 'calc(100% - 93px)'
        }}
        ref={node => { browser = node }}
      />
    </div>
  );
}