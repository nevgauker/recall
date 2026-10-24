import { SignIn } from '@clerk/nextjs'
import { AuthShell } from '@/components/brand'

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn />
    </AuthShell>
  )
}
