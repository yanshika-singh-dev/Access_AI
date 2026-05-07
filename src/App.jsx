import { useState } from 'react'
import Home      from './components/Home.jsx'
import WeSee     from './components/wesee/WeSee.jsx'
import SignSpeak from './components/signspeak/SignSpeak.jsx'

export default function App() {
  const [page, setPage] = useState('home') // 'home' | 'wesee' | 'signspeak'

  if (page === 'wesee')     return <WeSee     onBack={() => setPage('home')} />
  if (page === 'signspeak') return <SignSpeak onBack={() => setPage('home')} />
  return <Home onNavigate={setPage} />
}
