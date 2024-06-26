import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import './App.global.css';

import MainView from "./views/MainView";

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={() => <MainView />} />
      </Switch>
    </Router>
  );
}
