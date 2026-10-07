// Shared server-side booking approve / reject / delete logic.
// Mirrors what the dashboard does in src/hooks/useBookingRequests.ts so the
// same outcome happens whether the owner clicks in the dashboard, taps a
// Telegram button, or asks the AI agent.

import { sendSms, renderTemplate } from "./sms/service.ts";

type Admin = any;

export type BookingAction = "approve" | "reject" | "delete";

export interface BookingActionResult {
  ok: boolean;
  action: BookingAction;
  status?: string;
  bookingId: string;
  requesterName?: string;
  message: string;
  error?: string;
  alreadyDone?: boolean;
}

const OVERLAP = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && aE > bS;

export async function getBookingById(admin: Admin, bookingId: string) {
  const { data } = await admin
    .from("booking_requests")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  return data;
}

/** Resolve the owner (auth user id) that a booking request belongs to. */
export async function resolveBookingOwnerId(admin: Admin, booking: any): Promise<string | null> {
  if (booking?.user_id) return booking.user_id;
  if (!booking?.business_id) return null;
  const { data } = await admin
    .from("business_profiles")
    .select("user_id")
    .eq("id", booking.business_id)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function copyBookingFilesToEvent(admin: Admin, booking: any, eventId: string, userId: string) {
  const copyOne = async (filePath: string, filename: string, contentType: string, size: number) => {
    try {
      const clean = String(filePath).replace(/^\/+/, "");
      const { data: fileData, error: dlErr } = await admin.storage
        .from("booking_attachments")
        .download(clean);
      if (dlErr || !fileData) return;

      const newPath = `${eventId}/${crypto.randomUUID()}_${filename.replace(/\s+/g, "_")}`;
      const { error: upErr } = await admin.storage
        .from("event_attachments")
        .upload(newPath, fileData, { contentType: contentType || "application/octet-stream" });
      if (upErr) return;

      await admin.from("event_files").insert({
        filename,
        file_path: newPath,
        content_type: contentType || "application/octet-stream",
        size: size || 0,
        user_id: userId,
        event_id: eventId,
        source: "booking_request",
      });
    } catch (e) {
      console.error("copyBookingFilesToEvent error:", e);
    }
  };

  if (booking.file_path) {
    await copyOne(
      booking.file_path,
      booking.filename || "attachment",
      booking.content_type || "application/octet-stream",
      booking.size || 0,
    );
  }

  const { data: bookingFiles } = await admin
    .from("booking_files")
    .select("filename, file_path, content_type, size")
    .eq("booking_request_id", booking.id);

  for (const f of bookingFiles || []) {
    await copyOne(f.file_path, f.filename, f.content_type, f.size);
  }
}

async function sendApprovalEmail(
  admin: Admin,
  booking: any,
  ownerId: string,
  ownerNote: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  try {
    if (!booking.requester_email) return;

    const { data: biz } = await admin
      .from("business_profiles")
      .select("business_name, contact_address")
      .eq("id", booking.business_id)
      .maybeSingle();

    let ownerEmail: string | undefined;
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(ownerId);
      ownerEmail = userRes?.user?.email ?? undefined;
    } catch { /* optional */ }

    await fetch(`${supabaseUrl}/functions/v1/send-booking-approval-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        recipientEmail: booking.requester_email,
        fullName: booking.requester_name || booking.title || "Customer",
        businessName: biz?.business_name || "SmartBookly",
        startDate: booking.start_date,
        endDate: booking.end_date,
        paymentStatus: booking.payment_status || "not_paid",
        paymentAmount: booking.payment_amount,
        businessAddress: biz?.contact_address || "",
        eventId: booking.id,
        language: booking.language || "en",
        eventNotes: booking.description || "",
        ownerEmail,
        ownerNote: ownerNote || undefined,
      }),
    });
  } catch (e) {
    console.error("sendApprovalEmail error:", e);
  }
}

export async function performBookingAction(
  admin: Admin,
  params: {
    bookingId: string;
    action: BookingAction;
    ownerNote?: string;
    supabaseUrl: string;
    serviceKey: string;
    /** When set, the booking must belong to this owner. */
    expectedOwnerId?: string;
  },
): Promise<BookingActionResult> {
  const { bookingId, action, supabaseUrl, serviceKey } = params;
  const ownerNote = (params.ownerNote || "").trim();

  const booking = await getBookingById(admin, bookingId);
  if (!booking) {
    return { ok: false, action, bookingId, message: "Booking request not found.", error: "not_found" };
  }

  const ownerId = await resolveBookingOwnerId(admin, booking);
  if (params.expectedOwnerId && ownerId && ownerId !== params.expectedOwnerId) {
    return { ok: false, action, bookingId, message: "Not allowed.", error: "forbidden" };
  }
  if (!ownerId) {
    return { ok: false, action, bookingId, message: "Could not resolve the business owner.", error: "no_owner" };
  }

  const requesterName = booking.requester_name || booking.title || "Customer";

  // ── DELETE ────────────────────────────────────────────────────────────
  if (action === "delete") {
    if (booking.deleted_at) {
      return { ok: true, action, bookingId, requesterName, alreadyDone: true, message: `The booking request from ${requesterName} was already deleted.` };
    }
    const { error } = await admin
      .from("booking_requests")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", bookingId);
    if (error) return { ok: false, action, bookingId, requesterName, message: "Could not delete the booking request.", error: error.message };
    return { ok: true, action, bookingId, requesterName, status: "deleted", message: `Deleted the booking request from ${requesterName}.` };
  }

  // ── REJECT ────────────────────────────────────────────────────────────
  if (action === "reject") {
    if (booking.status === "rejected") {
      return { ok: true, action, bookingId, requesterName, status: "rejected", alreadyDone: true, message: `The booking request from ${requesterName} was already rejected.` };
    }
    if (booking.status === "approved") {
      return { ok: false, action, bookingId, requesterName, status: "approved", message: `That booking from ${requesterName} was already approved — I can delete it instead if you want.`, error: "already_approved" };
    }
    const { error } = await admin
      .from("booking_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", bookingId);
    if (error) return { ok: false, action, bookingId, requesterName, message: "Could not reject the booking request.", error: error.message };
    return { ok: true, action, bookingId, requesterName, status: "rejected", message: `Rejected the booking request from ${requesterName}.` };
  }

  // ── APPROVE ───────────────────────────────────────────────────────────
  if (booking.status === "approved") {
    return { ok: true, action, bookingId, requesterName, status: "approved", alreadyDone: true, message: `The booking from ${requesterName} was already approved.` };
  }

  const bStart = new Date(booking.start_date);
  const bEnd = new Date(booking.end_date);

  // Conflict check against existing events of the same owner
  const { data: existingEvents } = await admin
    .from("events")
    .select("id, title, start_date, end_date")
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .gte("end_date", new Date(bStart.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .lte("start_date", new Date(bEnd.getTime() + 24 * 60 * 60 * 1000).toISOString());

  const conflict = (existingEvents || []).find(
    (e: any) => e.id !== bookingId && OVERLAP(bStart, bEnd, new Date(e.start_date), new Date(e.end_date)),
  );
  if (conflict) {
    return {
      ok: false,
      action,
      bookingId,
      requesterName,
      message: `That time overlaps with "${conflict.title}" already on the calendar, so I did not approve it.`,
      error: "time_conflict",
    };
  }

  const { error: updErr } = await admin
    .from("booking_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (updErr) {
    return { ok: false, action, bookingId, requesterName, message: "Could not approve the booking request.", error: updErr.message };
  }

  const notes = [booking.description, ownerNote].filter(Boolean).join("\n\n");

  // Customer record (CRM)
  const { error: custErr } = await admin.from("customers").insert([{
    id: bookingId,
    user_id: ownerId,
    title: requesterName,
    user_surname: booking.user_surname || requesterName,
    user_number: booking.requester_phone,
    social_network_link: booking.requester_email,
    payment_status: booking.payment_status || "not_paid",
    payment_amount: booking.payment_amount,
    start_date: booking.start_date,
    end_date: booking.end_date,
    event_notes: notes,
    type: "booking_request",
    create_event: true,
    event_id: bookingId,
  }]);
  if (custErr) console.error("customer insert error:", custErr.message);

  // Calendar event
  const { error: evtErr } = await admin.from("events").insert([{
    id: bookingId,
    user_id: ownerId,
    title: booking.title,
    user_surname: booking.user_surname || requesterName,
    user_number: booking.requester_phone,
    social_network_link: booking.requester_email,
    start_date: booking.start_date,
    end_date: booking.end_date,
    payment_status: booking.payment_status || "not_paid",
    payment_amount: booking.payment_amount,
    type: "booking_request",
    booking_request_id: bookingId,
    event_notes: notes,
    language: booking.language || "en",
  }]);
  if (evtErr) {
    console.error("event insert error:", evtErr.message);
    return { ok: false, action, bookingId, requesterName, message: "Approved the request but could not add it to the calendar.", error: evtErr.message };
  }

  await copyBookingFilesToEvent(admin, booking, bookingId, ownerId);
  await sendApprovalEmail(admin, booking, ownerId, ownerNote, supabaseUrl, serviceKey);

  // SMS confirmation — a side effect only; never affects the booking outcome.
  try {
    if (booking.requester_phone) {
      const { data: biz } = await admin
        .from("business_profiles")
        .select("business_name")
        .eq("id", booking.business_id)
        .maybeSingle();
      const smsBody = await renderTemplate(admin, ownerId, "booking_confirmed", booking.language || "en", {
        name: requesterName,
        title: booking.title || "",
        business: biz?.business_name || "SmartBookly",
        date: new Date(booking.start_date).toLocaleString(),
      });
      await sendSms(admin, {
        ownerId,
        to: booking.requester_phone,
        body: smsBody,
        purpose: "booking_confirmed",
        language: booking.language || "en",
        eventId: bookingId,
        bookingRequestId: bookingId,
        dedupeKey: `booking_confirmed:${bookingId}`,
      });
    }
  } catch (e) {
    console.error("booking confirmation SMS error (ignored):", e);
  }

  return {
    ok: true,
    action,
    bookingId,
    requesterName,
    status: "approved",
    message: `Approved the booking from ${requesterName}. It is now on the calendar and in CRM, and the confirmation email was sent.`,
  };
}

// ── Telegram helpers ────────────────────────────────────────────────────

export async function getActiveTelegramConfig(admin: Admin, ownerId: string) {
  const { data } = await admin
    .from("telegram_bot_configs")
    .select("bot_token, telegram_chat_id, is_active")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data?.bot_token || !data?.telegram_chat_id) return null;
  return data;
}

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatBookingCard(booking: any, language = "en"): string {
  const fmt = (d: string) => {
    try {
      return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return d;
    }
  };
  const cur = language === "ka" ? "₾" : language === "es" ? "€" : "$";
  const lines = [
    "📩 <b>New booking request</b>",
    "",
    `👤 <b>${esc(booking.requester_name || booking.title)}</b>`,
    `📝 ${esc(booking.title)}`,
    `🕒 ${esc(fmt(booking.start_date))} → ${esc(fmt(booking.end_date))}`,
  ];
  if (booking.requester_phone) lines.push(`📞 ${esc(booking.requester_phone)}`);
  if (booking.requester_email) lines.push(`✉️ ${esc(booking.requester_email)}`);
  if (booking.payment_amount) lines.push(`💰 ${cur}${esc(booking.payment_amount)} (${esc(booking.payment_status || "not paid")})`);
  if (booking.description) lines.push(`💬 ${esc(String(booking.description).slice(0, 500))}`);
  lines.push("", "Tap a button below, or just reply telling me what to do.");
  return lines.join("\n");
}

export async function sendBookingCardToTelegram(admin: Admin, ownerId: string, booking: any) {
  try {
    const cfg = await getActiveTelegramConfig(admin, ownerId);
    if (!cfg) return false;

    const res = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.telegram_chat_id,
        text: formatBookingCard(booking, booking.language || "en"),
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `bk:approve:${booking.id}` },
            { text: "❌ Reject", callback_data: `bk:reject:${booking.id}` },
          ], [
            { text: "🗑 Delete", callback_data: `bk:delete:${booking.id}` },
          ]],
        },
      }),
    });
    if (!res.ok) console.error("sendBookingCardToTelegram failed:", await res.text());
    return res.ok;
  } catch (e) {
    console.error("sendBookingCardToTelegram error:", e);
    return false;
  }
}
