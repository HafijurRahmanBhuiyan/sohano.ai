import AuthForm from '../components/AuthForm'
import { useAuthStore } from '../store/auth'

export default function SignupPage() {
  const signup = useAuthStore((s) => s.signup)
  return <AuthForm mode="signup" onSubmit={(name, email, password) => signup(name, email, password)} />
}
