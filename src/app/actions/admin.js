"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function assertAdmin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Admin only." };
  return null;
}

export async function submitReport(formData) {
  const supabase = await createClient();
  const reported = formData.get("reportedUserId");
  const reason = String(formData.get("reason") || "").trim();
  const image = formData.get("image");

  if (!reported) return { error: "A user to report is required." };
  if (reason.length < 5) return { error: "Reason must be at least 5 characters." };
  if (reason.length > 2000) return { error: "Reason too long (max 2000)." };

  let imageUrl = null;
  if (image && image.size) {
    if (!String(image.type || "").startsWith("image/"))
      return { error: "Picture must be an image." };
    if (image.size > 5 * 1024 * 1024)
      return { error: "Picture too large (max 5 MB)." };
    const ex = image.name.includes(".") ? image.name.split(".").pop().toLowerCase() : "png";
    const safe = "png|jpg|jpeg|webp|gif".includes(ex) ? ex : "png";
    const path = `reports/${reported}/${Date.now()}.${safe}`;
    const { error: upErr } = await supabase.storage
      .from("match-proofs")
      .upload(path, await image.arrayBuffer(), { contentType: image.type, upsert: false });
    if (upErr) return { error: upErr.message };
    const { data: signed } = await supabase.storage
      .from("match-proofs")
      .createSignedUrl(path, 3600);
    imageUrl = signed?.signedUrl || null;
  }

  const { error } = await supabase.rpc("create_report", {
    p_reported: reported,
    p_reason: reason,
    p_image_url: imageUrl,
  });
  if (error) return { error: error.message };
  revalidatePath(`/profile/${reported}`);
  return { success: true };
}

export async function adminSetBanned(formData) {
  const supabase = await createClient();
  const denied = await assertAdmin(supabase);
  if (denied) return denied;
  const userId = formData.get("userId");
  const banned = formData.get("banned") === "1";
  if (!userId) return { error: "User required." };
  const { error } = await supabase.rpc("admin_set_banned", {
    p_user_id: userId,
    p_banned: banned,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function adminSetTournamentPermission(formData) {
  const supabase = await createClient();
  const denied = await assertAdmin(supabase);
  if (denied) return denied;
  const userId = formData.get("userId");
  const can = formData.get("can") === "1";
  if (!userId) return { error: "User required." };
  const { error } = await supabase.rpc("admin_set_tournament_permission", {
    p_user_id: userId,
    p_can: can,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function adminUpdateReportStatus(formData) {
  const supabase = await createClient();
  const denied = await assertAdmin(supabase);
  if (denied) return denied;
  const reportId = formData.get("reportId");
  const status = formData.get("status");
  if (!reportId || !["open", "resolved", "dismissed"].includes(status))
    return { error: "Invalid report status." };
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", reportId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}