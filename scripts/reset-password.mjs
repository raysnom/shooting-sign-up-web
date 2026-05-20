import { createClient } from "@supabase/supabase-js";

const EMAIL = "rayson_tan_rui_sheng@students.edu.sg";
const NEW_PASSWORD = "Rayson2026!";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with:  node --env-file=.env.local scripts/reset-password.mjs");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Looking up user: ${EMAIL}`);

let userId = null;
let page = 1;
const perPage = 1000;

while (!userId) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) {
    console.error("Failed to list users:", error.message);
    process.exit(1);
  }
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === EMAIL.toLowerCase()
  );
  if (match) {
    userId = match.id;
    break;
  }
  if (data.users.length < perPage) break;
  page += 1;
}

if (!userId) {
  console.error(`No user found with email ${EMAIL}`);
  process.exit(1);
}

console.log(`Found user id: ${userId}`);
console.log(`Resetting password to: ${NEW_PASSWORD}`);

const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
  password: NEW_PASSWORD,
});

if (updateError) {
  console.error("Password update failed:", updateError.message);
  process.exit(1);
}

console.log("Password reset successful.");
