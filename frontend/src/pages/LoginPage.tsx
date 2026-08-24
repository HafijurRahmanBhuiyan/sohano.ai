import AuthForm from '../components/AuthForm'
import { useAuthStore } from '../store/auth'

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  return <AuthForm mode="login" onSubmit={(_, email, password) => login(email, password)} />
}
