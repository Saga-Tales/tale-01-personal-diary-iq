import { Navigate } from 'react-router-dom'
import { getApiKey } from '@/lib/anthropic'

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  if (!getApiKey()) return <Navigate to="/settings" replace />
  return <>{children}</>
}
