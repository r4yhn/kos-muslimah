"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type LoginState = string | undefined;

/**
 * Server action login — dipanggil dari form /login via useActionState.
 * Mengembalikan pesan error, atau melempar redirect ke /dashboard saat sukses.
 */
export async function authenticate(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Email atau password salah.";
        default:
          return "Terjadi kesalahan. Silakan coba lagi.";
      }
    }
    throw error;
  }
}
