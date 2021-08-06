import React, { useState, useEffect } from 'react';

import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Grid from '@material-ui/core/Grid';

import PlayArrow from '@material-ui/icons/PlayArrow';
import Stop from '@material-ui/icons/Stop';

import { makeStyles } from '@material-ui/core/styles';
import * as colors from '@material-ui/core/colors';

import Timer from 'react-compound-timer';

import * as WorkSess from '../WorkSess';

export default function TopBar({}) {
  const [isStarted, setIsStarted] = useState(false);

  async function toggleTimer(e, start, stop, reset) {
    if (isStarted) {
      stop();
      WorkSess.onStop();
      reset();
    } else {
      start();
      await WorkSess.onStart();
    }
    setIsStarted(!isStarted);
  }

  return (
    <AppBar color='default'>
      <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          margin: 'auto',
          padding: '1em 0',
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
                  spacing={2}
                >
                  <Grid item />
                  <Grid item />
                  <Grid item>
                    <div style={{ fontSize: 28 }}>
                      <Timer.Days />d <Timer.Hours />h <Timer.Minutes />m <Timer.Seconds />s
                    </div>
                  </Grid>
                  <Grid item>
                    <IconButton 
                      variant="contained" 
                      style={{ backgroundColor: (isStarted ? colors.red[400] : colors.green[400]) }}
                      onClick={async (e) => { await toggleTimer(e, start, stop, reset); }}
                    >
                      { isStarted ? <Stop /> : <PlayArrow /> }
                    </IconButton>
                  </Grid>
                </Grid>
              </React.Fragment>
            )}
          </Timer>
        </Toolbar>
      </div>
    </AppBar>
  );
}