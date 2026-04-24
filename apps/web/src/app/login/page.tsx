'use client'

import { Suspense } from 'react'
import LoginContent from './LoginContent'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}