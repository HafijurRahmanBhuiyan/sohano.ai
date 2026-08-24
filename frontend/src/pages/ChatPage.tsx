import { useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <main className="flex min-h-0 flex-1 flex-col">
          <ChatWindow />
        </main>
      </div>
    </div>
  )
}
