import { LoginForm } from "./login-form";
import { googleClientIdFromEnvironment } from "../../lib/google-auth-config";
import { getLoginOptions } from "../../lib/login-options";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const options = await getLoginOptions();
  return (
    <LoginForm
      googleClientId={options.googleClientId ?? googleClientIdFromEnvironment()}
      nativeSignInEnabled={options.nativeSignInEnabled}
    />
  );
}
