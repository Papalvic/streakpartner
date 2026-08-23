"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function getAppOrigin() {
  // Environment-aware: production uses the deployed Vercel URL, dev stays localhost.
  const deployed = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (deployed) {
    return deployed.startsWith("http") ? deployed : `https://${deployed}`;
  }
  return "http://localhost:3000";
}

export async function signUp(prevState, formData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");
  const username = formData.get("username");
  const displayName = formData.get("displayName");
  const inviteCodeRaw = formData.get("inviteCode");
  const inviteCode = String(inviteCodeRaw || "").trim();

  if (!email || !password || !username) {
    return { error: "Email, password and username are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Redirect back to the deployed app (never default localhost) after email verification.
      emailRedirectTo: `${getAppOrigin()}/login`,
      data: {
        username: username.toLowerCase().replace(/\s+/g, "_"),
        display_name: displayName || username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is ENABLED, signUp returns a session: null and
  // requires the user to click the confirmation link before logging in.
  if (data?.session) {
    // Confirmation is disabled — user is already authenticated (profile trigger ran).
    if (inviteCode) {
      await supabase.rpc("apply_referral_code", { p_code: inviteCode });
    }
    revalidatePath("/", "layout");
    redirect("/");
  }

  // Confirmation is enabled — user must verify their email first.
  return {
    success: true,
    message:
      "Account created. Please check your email and click the confirmation link, then log in.",
  };
}

export async function logIn(prevState, formData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Blocked users are not allowed to log in.
  const uid = signInData?.user?.id;
  if (uid) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", uid)
      .single();
    if (profile?.is_banned) {
      await supabase.auth.signOut();
      return {
        error: "Your account has been blocked. Please contact support.",
      };
    }
  }

  // Force the auth session cookies to be written before redirecting.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      error: "Failed to establish a session. Please try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(prevState, formData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    return { error: "Email is required." };
  }

  // Always return the same generic response regardless of whether the email exists.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppOrigin()}/reset-password`,
  });

  return {
    success: true,
    message: "If that email is registered, a password reset link has been sent.",
  };
}

export async function resetPassword(prevState, formData) {
  const supabase = await createClient();
  const password = formData.get("password");
  const confirm = formData.get("confirmPassword");

  if (!password || !confirm) {
    return { error: "Please fill in both password fields." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Password updated successfully." };
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}