import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import HomePage from './pages/Home.jsx';
import PlayPage from './pages/Play.jsx';
import ChallengePage from './pages/Challenge.jsx';
import ProgressPage from './pages/Progress.jsx';
import SettingsPage from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/challenge" element={<ChallengePage />} />
      <Route path="/progress" element={<ProgressPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
