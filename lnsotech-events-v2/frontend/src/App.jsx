import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('@lnsotech:token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('@lnsotech:user')) || null);

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('@lnsotech:token', newToken);
    localStorage.setItem('@lnsotech:user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('@lnsotech:token');
    localStorage.removeItem('@lnsotech:user');
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard token={token} user={user} onLogout={handleLogout} />;
}
