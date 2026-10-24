import { auth } from '@clerk/nextjs/server'
import { Landing } from '@/components/landing'
import { Workspace } from '@/components/workspace'

/**
 * One URL for both audiences: someone following a shared link sees what
 * Recall is before being asked to sign in; a signed-in user goes straight to
 * the app. The API routes stay protected regardless (see proxy.ts).
 */
export default async function Home() {
  const { userId } = await auth()
  return userId ? <Workspace /> : <Landing />
}
