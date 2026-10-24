import { SignUp } from '@clerk/nextjs'
import { AuthShell } from '@/components/brand'

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp />
    </AuthShell>
  )
}
