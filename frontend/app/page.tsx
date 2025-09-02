'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    console.log('HomePage: Redirecting to /tickets')
    router.replace('/tickets')
  }, [router])

  return (
    <div>Redirecting to tickets...</div>
  )
}
