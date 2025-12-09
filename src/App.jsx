import React, { useState, useEffect } from 'react'
import Header from './components/Header'
import PowerBIEmbed from './components/PowerBIEmbed'
import DataView from './components/DataView'
import Login from './components/Login'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setIsLoading(false)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    setUser(null)
    setActiveView('dashboard')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-secondary-600">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="bg-secondary-50 min-h-screen">
      <Header 
        activeView={activeView} 
        setActiveView={setActiveView}
        user={user}
        onLogout={handleLogout}
      />
      
      {/* Main Content - Full Width */}
      <main className="pt-16">
        {activeView === 'dashboard' ? <PowerBIEmbed /> : <DataView userEmail={user?.email} />}
      </main>
    </div>
  )
}

export default App
