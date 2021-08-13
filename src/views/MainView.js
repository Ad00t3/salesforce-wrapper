import React, { useState, useEffect, useRef } from 'react';

import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Grid from '@material-ui/core/Grid';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { useTheme } from '@material-ui/core/styles';

import PlayArrow from '@material-ui/icons/PlayArrow';
import Stop from '@material-ui/icons/Stop';

import { makeStyles } from '@material-ui/core/styles';
import * as colors from '@material-ui/core/colors';
import PuffLoader from "react-spinners/PuffLoader";

import Timer from 'react-compound-timer';
import WebView from 'react-electron-web-view';
import * as WorkSess from '../core/WorkSess';
import config from '../config/config';
import * as util from '../util/util';

export default function MainView({}) {
  const [isStarted, setIsStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [workType, setWorkType] = useState('');
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState(-1);
  const [session, setSession] = useState({});
  const [alertCacheOpen, setAlertCacheOpen] = useState(false);

  const browserRef = useRef(null);
  const canvasRef = useRef(null);

  var resolveAlertCache;

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

  function alertCache() {
    return new Promise((resolve, reject) => {
      resolveAlertCache = resolve;
      setAlertCacheOpen(true);
    })
  }

  async function toggleWorkSess(start, stop, reset) {
    raiseError('');
    let success = false;
    
    if (isStarted) { // STOP
      stop();
      reset();
      setStartTime(-1);
      setLoading(true);
      const { errors } = await WorkSess.onStop();
      setLoading(false);
      if (errors.length !== 0) {
        raiseError(`Encountered error(s) while trying to stop work session: ${errors.join(', ')}`);
      }
      success = true;
    } else { // START
      if (browserRef.current.getURL().startsWith('https://assurehealth--hc.lightning.force.com/lightning/r/Account/')) {
        setLoading(true);
        const { errors, session } = await WorkSess.onStart(workType, browserRef.current, canvasRef.current, alertCache);
        setLoading(false);
        setSession(session);
        if (errors.length === 0) {
          start();
          setStartTime(Date.now());
          success = true;
        } else {
          raiseError(`Encountered error(s) while trying to start work session: ${errors.join(', ')}`);
        }
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
                        autoHideDuration={3000} 
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
                        <Timer.Hours />h <Timer.Minutes />m <Timer.Seconds />s
                      </div>
                    </Grid>
                    <Grid item>
                      <IconButton 
                        variant="contained" 
                        style={{ backgroundColor: (isStarted ? colors.red[400] : colors.green[400]) }}
                        onClick={async () => { await toggleWorkSess(start, stop, reset); }}
                        disabled={loading}
                      >
                        { isStarted ? <Stop /> : <PlayArrow /> }
                      </IconButton>
                    </Grid>
                    <Grid item>
                      <WorkTypeComboBox workType={workType} setWorkType={setWorkType} />
                    </Grid>
                  </Grid>
                </React.Fragment>
              )}
            </Timer>
          </Toolbar>
        </div>
      </AppBar>
      <AlertCache 
        open={alertCacheOpen}
        setOpen={setAlertCacheOpen}
        resolveAlertCache={resolveAlertCache}
      />
      <PuffLoader
        color={colors.purple[700]}
        css={'display: block; margin: 0 auto;'}
        loading={true}
        size="6em"
      />
      <WebView 
        src={'https://assurehealth--hc.my.salesforce.com/'}
        style={{ 
          display: (loading ? 'none' : 'grid'),
          position: 'absolute',
          left: '-8px',
          top: '85px',
          width: '100vw',
          height: 'calc(100% - 93px)'
        }}
        ref={browserRef}
        disablewebsecurity
        allowpopups
      />
      <Canvas 
        isStarted={isStarted}
        startTime={startTime}
        session={session}
        ref={canvasRef}
      />
    </div>
  );
}

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

function AlertCache({ open, setOpen, resolveAlertCache }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  function handleClose(isNewSession) {
    setOpen(false);
    resolveAlertCache(isNewSession);
  };

  return (
    <div>
      <Dialog
        fullScreen={fullScreen}
        open={open}
        aria-labelledby="responsive-dialog-title"
        onClose={(event, reason) => {
          if (reason !== 'backdropClick' && reason !== 'escapeKeyDown')
            handleClose(false);
        }}
      >
        <DialogTitle id="responsive-dialog-title">Cached Session Found</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A cached session was recovered. Would you like to resume
            recording it or delete it and start a new session?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => handleClose(false)} color="primary">
            Resume
          </Button>
          <Button onClick={() => handleClose(true)} color="secondary" autoFocus>
            Restart
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function WorkTypeComboBox({ workType, setWorkType }) {
  const filter = createFilterOptions();

  useEffect(() => {
    const workTypes = config.get('workTypes');
    if (workTypes.length > 0)
      setWorkType(workTypes[0]);
  });

  return (
    <Autocomplete
      value={workType}
      onChange={(event, newValue) => {
        if (newValue) {
          if (newValue.inputValue) {
            setWorkType(newValue.inputValue);  
            config.set('workTypes', [ ...config.get('workTypes'), newValue.inputValue ]);
          } else {
            setWorkType(newValue);
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
        <TextField {...params} label="Activity Type" variant="outlined" />
      )}
    />
  );
}

const Canvas = React.forwardRef(({ isStarted, startTime, session }, ref) => {  
  function draw(ctx) {
    // Background
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (isStarted) {
      ctx.fillStyle = 'white';
      var x = 10, y = 32;
      var ls1 = 24, ls2 = 18;

      ctx.font = "26px Arial";
      const { hours, minutes, seconds } = util.deconstructDuration(Math.round((Date.now() - startTime) / 1000.0));
      ctx.fillText(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, x, y); y += ls1;

      ctx.font = "13px Arial";
      ctx.fillText(`Patient: ${session.patientName} (ID: ${session.payload.patient_ID})`, x, y); y += ls2;
      ctx.fillText(`Session ID: ${session.id}`, x, y); y += ls2;
      const clinSplit = session.payload.clinician_name.split(' ');
      ctx.fillText(`Care Manager: ${clinSplit[1]}, ${clinSplit[0]}`, x, y); y += ls2;
      ctx.fillText(`Work Performed By: ${session.payload.clinician_name}`, x, y); y += ls2;
      const timeStr = new Date(session.payload.start_time).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      const durationStr = `${hours} hr, ${minutes} min, ${seconds} sec`;
      ctx.fillText(`Started: ${timeStr} EDT (${durationStr})`, x, y);
    }
  }
  
  useEffect(() => {
    const context = ref.current.getContext('2d');
    context.canvas.hidden = true;
    let animationFrameId;
    function render() {
      draw(context);
      animationFrameId = window.requestAnimationFrame(render);
    }
    render();
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    }
  }, [draw]);

  const sWidth = config.get('rec.sWidth');
  const sHeight = config.get('rec.sHeight');
  const f = config.get('rec.f');

  return (
    <canvas 
      ref={ref} 
      width={sWidth / f} 
      height={config.get('rec.useWebcam') ? sHeight - (sHeight / f) : sHeight} 
    />
  );
});