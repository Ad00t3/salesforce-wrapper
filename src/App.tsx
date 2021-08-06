import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import './App.global.css';

import TopBar from "./components/TopBar";

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={() => <TopBar />} />
      </Switch>
    </Router>
  );
}
