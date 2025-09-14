"use client"

import { useEffect, useState } from 'react'
import { useSSRSafeUserStore } from '@/lib/store/ssr-safe-user-store'
import { clientSideLogout } from '@/lib/security/session-manager'

export function BannedUserModal() {
  const { user, profile } = useSSRSafeUserStore()
  const [open, setOpen] = useState(false)
  const isBanned = !!profile?.banned

  // Open the modal when profile indicates banned
  useEffect(() => {
    if (user && isBanned) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [user, isBanned])

  // Also react immediately to server-side enforcement via a global event
  useEffect(() => {
    function onBannedEvent() {
      setOpen(true)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('fyp:user-banned', onBannedEvent as EventListener)
      return () => window.removeEventListener('fyp:user-banned', onBannedEvent as EventListener)
    }
  }, [])

  const handleLogout = async () => {
    try {
      // First call server-side enhanced logout to clear httpOnly cookies
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (err) {
        console.warn('Logout API call failed, falling back to client-only logout:', err)
      }

      // Then perform client-side cleanup to remove any residual storage/session
      if (user?.id) {
        await clientSideLogout(user.id)
      }

      // Hard redirect to login to ensure all state is cleared
      if (typeof window !== 'undefined') {
        window.location.href = '/en/auth/login?banned=1'
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        window.location.href = '/en/auth/login?banned=1'
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Your account has been banned</h2>
          <p className="mt-2 text-sm text-gray-600">Please contact support if you believe this is a mistake.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleLogout}
            className="w-full rounded-md bg-black py-2.5 text-white hover:bg-gray-900 active:opacity-90"
          >
            LOG OUT NOW
          </button>
          <a
            href="https://t.me/m/zDsQTcg4MDJl"
            target="_blank"
            className="w-full rounded-md border border-gray-300 py-2.5 text-center text-sm text-gray-800 hover:bg-gray-50"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}

