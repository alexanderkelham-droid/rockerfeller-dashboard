import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Load users from localStorage (which includes CSV users + new signups)
      const storedUsers = localStorage.getItem('allUsers');
      let users = [];

      if (storedUsers) {
        users = JSON.parse(storedUsers);
      } else {
        // First time - load from CSV and store in localStorage
        const response = await fetch('/src/data/users.csv');
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        
        users = lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            email: values[0],
            password: values[1],
            name: values[2],
            initials: values[3],
            createdAt: values[4]
          };
        });
        
        // Save to localStorage for persistence
        localStorage.setItem('allUsers', JSON.stringify(users));
      }

      if (isSignUp) {
        // Sign up - check if user already exists
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
          setError('Email already exists');
          setLoading(false);
          return;
        }

        // Create new user
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
        const newUser = {
          email,
          password,
          name,
          initials,
          createdAt: new Date().toISOString()
        };

        // Add to users array and save back to localStorage
        users.push(newUser);
        localStorage.setItem('allUsers', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        onLogin(newUser);
      } else {
        // Login - verify credentials
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
          setError('Invalid email or password');
          setLoading(false);
          return;
        }

        localStorage.setItem('currentUser', JSON.stringify(user));
        onLogin(user);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/cata-logo.png" alt="CATA Logo" className="h-20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-secondary-800">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-secondary-600 mt-2">
            {isSignUp ? 'Sign up to access the platform' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="John Doe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-500 text-white py-2 rounded-md hover:bg-primary-600 transition-colors duration-200 font-medium disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setEmail('');
              setPassword('');
              setName('');
            }}
            className="text-sm text-primary-500 hover:text-primary-600 font-medium"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {!isSignUp && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700 font-medium mb-1">Demo Credentials:</p>
            <p className="text-xs text-blue-600">Email: admin@cata.org</p>
            <p className="text-xs text-blue-600">Password: admin123</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
