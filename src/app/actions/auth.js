"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signUp(prevState, formData) {
  const supabase = await createClient();

  const email = formData.get("email");
  const password = formData.get("password");
  const username = formData.get("username");
  const displayName = formData.get("displayName");

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
    // Confirmation is disabled — user is already authenticated.
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // IMPORTANT FIX: Force the auth session cookies to be written to the
  // response by reading the session back before redirecting. Without this,
  // the cookies set by signInWithPassword can be dropped when redirect() is
  // called in the same Server Action, leaving the user unauthenticated
  // after navigating to "/".
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

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
