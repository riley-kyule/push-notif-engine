import { LoginForm } from "./login-form";
import { googleClientIdFromEnvironment } from "../../lib/google-auth-config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm googleClientId={googleClientIdFromEnvironment()} />;
}
