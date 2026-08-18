"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signUp(formData) {
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

  const { error } = await supabase.auth.signUp({
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

  redirect("/");
}

export async function logIn(formData) {
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

  redirect("/");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}