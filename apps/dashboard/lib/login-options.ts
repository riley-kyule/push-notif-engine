import { apiJson } from "./server-api";

export interface LoginOptions {
  nativeSignInEnabled: boolean;
  nativeSignInForced: boolean;
  googleClientId: string | null;
}

export async function getLoginOptions(fetchImpl: typeof fetch = fetch): Promise<LoginOptions> {
  const response = await apiJson<{ success: true; data: LoginOptions }>(
    "/auth/login-options",
    undefined,
    fetchImpl,
  );
  return response?.data ?? {
    nativeSignInEnabled: true,
    nativeSignInForced: false,
    googleClientId: null,
  };
}
