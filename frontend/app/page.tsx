"use client"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import Link from "next/link"
import LoginForm from "@/components/login-form"

export default function Home() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const apiKey = localStorage.getItem("factionApiKey")
    if (apiKey) {
      setIsLoggedIn(true)
      router.push("/dashboard")
    }
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md flex-1 flex flex-col justify-center">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-2">OC 2.0 Dashboard</h1>
          <p className="text-muted-foreground text-lg">Organized Crimes made easy</p>
        </div>
        <LoginForm onLogin={() => setIsLoggedIn(true)} />
      </div>
      <footer className="w-full text-center py-4 text-sm space-y-2">
        <div>
          <a
            href="https://www.torn.com/profiles.php?XID=1712955"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-white/80 transition-colors"
          >
            © oxiblurr [1712955]
          </a>
        </div>
      </footer>
    </main>
  )
}
