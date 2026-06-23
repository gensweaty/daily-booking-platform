import { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Listens for AI-triggered screenshot requests for the CURRENT user only.
 * Per-user isolation: each admin / sub-user captures and receives only
 * their own viewport (filter is enforced both server-side via RLS and
 * client-side here).
 *
 * If `page_hint` matches a known dashboard tab (calendar / tasks /
 * crm / statistics / business — in EN / KA / RU / ES), we first
 * dispatch `switch-dashboard-tab` so the dashboard navigates there,
 * then capture ONLY the active tabpanel. Without a hint we capture
 * whichever panel is currently active.
 */
const TAB_KEYWORDS: Array<{ tab: string; words: string[] }> = [
  { tab: 'tasks', words: ['task', 'tasks', 'todo', 'to do', 'board', 'kanban', 'დავალებ', 'ამოცან', 'დაფა', 'задач', 'доск', 'tablero', 'tarea', 'tareas'] },
  { tab: 'calendar', words: ['calendar', 'booking calendar', 'agenda', 'schedule', 'კალენდ', 'ჯავშნ', 'календ', 'расписан', 'calendario'] },
  { tab: 'crm', words: ['crm', 'customer', 'customers', 'client', 'clients', 'contact', 'კლიენტ', 'მომხმარებ', 'контакт', 'клиент', 'cliente', 'clientes'] },
  { tab: 'statistics', words: ['statistic', 'statistics', 'stats', 'analytic', 'analytics', 'report', 'სტატისტ', 'ანალიტ', 'статист', 'аналит', 'отчет', 'estadist', 'informe'] },
  { tab: 'business', words: ['my business', 'business', 'profile', 'booking page', 'public page', 'ბიზნეს', 'პროფილ', 'бизнес', 'профил', 'negocio', 'perfil'] },
];

function resolveTab(hint?: string | null): string | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  for (const { tab, words } of TAB_KEYWORDS) {
    if (words.some((w) => h.includes(w))) return tab;
  }
  return null;
}

function resolvePopupTarget(hint?: string | null, explicit?: string | null): string | null {
  const h = `${explicit || ''} ${hint || ''}`.toLowerCase();
  if (!h.trim()) return null;
  if (/(profile|account|avatar|პროფილ|аккаунт|профил|perfil)/i.test(h)) return 'profile';
  if (/(add task|new task|create task|დაამატ.*დავალ|нов.*задач|crear.*tarea|agregar.*tarea)/i.test(h)) return 'add_task';
  return null;
}

async function waitForTabPanel(
  expectedTab: string | null,
  timeoutMs = 7000
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let el: HTMLElement | null = null;
    if (expectedTab) {
      const trigger = document.querySelector(
        `[data-dashboard-tab-trigger="${expectedTab}"][data-state="active"]`
      ) as HTMLElement | null;
      el = document.querySelector(
        `[data-dashboard-tab-panel="${expectedTab}"][data-state="active"]:not([hidden])`
      ) as HTMLElement | null;
      if (!el) {
        const all = Array.from(
          document.querySelectorAll('[role="tabpanel"][data-state="active"]:not([hidden])')
        ) as HTMLElement[];
        el =
          all.find((p) =>
            (p.id || '').toLowerCase().endsWith(`-${expectedTab}`)
          ) || null;
      }
      if (!trigger || !el) {
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
    } else {
      el = document.querySelector(
        '[role="tabpanel"][data-state="active"]:not([hidden])'
      ) as HTMLElement | null;
    }
    if (el && el.offsetHeight > 50) return el;
    await new Promise((r) => setTimeout(r, 120));
  }
  // Fallback: any active tabpanel
  return document.querySelector(
    '[role="tabpanel"][data-state="active"]:not([hidden])'
  ) as HTMLElement | null;
}

function getDashboardCaptureRoot(): HTMLElement | null {
  return document.querySelector('[data-screenshot-dashboard-root="true"]') as HTMLElement | null;
}

async function waitForElement(selector: string, timeoutMs = 5000): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
    await new Promise((r) => setTimeout(r, 120));
  }
  return document.querySelector(selector) as HTMLElement | null;
}

// Wait for all <img> inside the element to finish loading (best-effort)
async function waitForImages(el: HTMLElement, timeoutMs = 3000): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

// Double rAF + small idle wait so React/Recharts finish painting
async function waitForPaint(extraMs = 0) {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  if (extraMs > 0) await new Promise((r) => setTimeout(r, extraMs));
}

export function ScreenshotRequestListener() {
  const { user } = useAuth();
  const handlingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const handle = async (req: any) => {
      if (!req || req.status !== 'pending') return;
      if (req.user_id !== userId) return; // per-user isolation
      if (handlingRef.current.has(req.id)) return;
      handlingRef.current.add(req.id);

      try {
        const targetTab = resolveTab(req.page_hint);
        const popupTarget = resolvePopupTarget(req.page_hint, req.popup_target);
        let captureEl: HTMLElement = document.body;

        if (targetTab) {
          window.dispatchEvent(
            new CustomEvent('switch-dashboard-tab', { detail: { tab: targetTab } })
          );
          // Give React a moment to commit the state change before querying
          await new Promise((r) => setTimeout(r, 250));
          const panel = await waitForTabPanel(targetTab, 4000);
          if (panel) captureEl = getDashboardCaptureRoot() || panel;
        } else {
          const active = await waitForTabPanel(null, 1000);
          if (active) captureEl = getDashboardCaptureRoot() || active;
        }

        if (popupTarget === 'profile') {
          window.dispatchEvent(new CustomEvent('open-dashboard-profile'));
          const dialog = await waitForElement('[role="dialog"][data-state="open"]', 6000);
          if (dialog) captureEl = dialog;
        }

        if (popupTarget === 'add_task') {
          if (targetTab !== 'tasks') {
            window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: { tab: 'tasks' } }));
            await waitForTabPanel('tasks', 5000);
          }
          const addButton = await waitForElement('[data-tutorial="tasks-add-btn"]', 3000);
          addButton?.click();
          const dialog = await waitForElement('[data-tutorial="task-dialog"], [role="dialog"][data-state="open"]', 6000);
          if (dialog) captureEl = dialog;
        }

        // Wait for content to actually render. Stats has heavy charts that
        // need extra settle time; tasks/CRM lists also need a beat.
        await waitForPaint(0);
        await waitForImages(captureEl, 3500);
        // Heavier wait for tabs that mount async data (charts, lists)
        const settleMs = targetTab === 'statistics' ? 1800 : 1000;
        await new Promise((r) => setTimeout(r, settleMs));
        await waitForPaint(0);

        // Scroll element into view so html2canvas captures full content cleanly
        captureEl.scrollIntoView({ block: 'start' });
        await waitForPaint(50);

        // Full-element capture: use the element's full scroll size so we get
        // the whole page (not just the visible viewport)
        const fullW = Math.max(captureEl.scrollWidth, captureEl.clientWidth);
        const fullH = Math.max(captureEl.scrollHeight, captureEl.clientHeight);
        const canvas = await html2canvas(captureEl, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
          logging: false,
          scale: Math.min(window.devicePixelRatio || 1, 2),
          width: fullW,
          height: fullH,
          windowWidth: Math.max(document.documentElement.clientWidth, fullW),
          windowHeight: Math.max(document.documentElement.clientHeight, fullH),
          scrollX: 0,
          scrollY: -window.scrollY,
          // Exclude floating widgets (chat window, chat icon, dynamic island,
          // toasts, tooltips, etc.) so the captured layout matches the page
          // itself, not the overlays on top of it.
          ignoreElements: (node: Element) => {
            if (!(node instanceof HTMLElement)) return false;
            if (node.hasAttribute('data-screenshot-hide')) return true;
            const id = node.id || '';
            if (['chat-floating-root', 'chat-overlay'].includes(id)) return true;
            if (
              id.startsWith('radix-') &&
              (id.includes('toast') || id.includes('tooltip'))
            ) {
              return true;
            }
            const cls = node.className && typeof node.className === 'string' ? node.className : '';
            if (
              cls.includes('chat-icon-root') ||
              cls.includes('dynamic-island-root')
            ) {
              return true;
            }
            // Skip fixed-position overlays that are not part of the captured panel
            const style = window.getComputedStyle(node);
            if (style.position === 'fixed' && !captureEl.contains(node)) {
              return true;
            }
            return false;
          },
          onclone: (doc) => {
            const root = (popupTarget
              ? doc.querySelector('[role="dialog"][data-state="open"]')
              : doc.querySelector('[data-screenshot-dashboard-root="true"]')) as HTMLElement | null;
            if (!root) return;
            root.querySelectorAll<HTMLElement>('*').forEach((el) => {
              el.style.animation = 'none';
              el.style.transition = 'none';
            });
          },
        });
        const blob: Blob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 0.92)
        );

        const path = `${userId}/${req.id}.png`;
        const { error: upErr } = await supabase.storage
          .from('screenshots')
          .upload(path, blob, { contentType: 'image/png', upsert: true });
        if (upErr) throw upErr;

        const { data: signed, error: signErr } = await supabase.storage
          .from('screenshots')
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signErr || !signed?.signedUrl) throw signErr || new Error('sign failed');
        const imageUrl = signed.signedUrl;

        if (req.ai_channel_id) {
          const caption = req.caption || 'Screenshot';
          const content = `📸 ${caption}\n\n![screenshot](${imageUrl})`;
          await supabase.from('chat_messages').insert({
            channel_id: req.ai_channel_id,
            content,
            sender_type: 'admin',
            sender_user_id: userId,
            sender_name: 'Smartbookly AI',
            owner_id: userId,
            message_type: 'text',
            metadata: { source_kind: 'screenshot', screenshot_request_id: req.id },
          });
        }

        if (req.via_telegram) {
          await supabase.functions.invoke('send-telegram-screenshot', {
            body: { user_id: userId, image_url: imageUrl, caption: req.caption || 'Screenshot' },
          });
        }

        await supabase
          .from('screenshot_requests')
          .update({ status: 'fulfilled', image_url: imageUrl, fulfilled_at: new Date().toISOString() })
          .eq('id', req.id);
      } catch (err: any) {
        console.error('[ScreenshotRequestListener] failed:', err);
        try {
          await supabase
            .from('screenshot_requests')
            .update({ status: 'failed', error: String(err?.message || err) })
            .eq('id', req.id);
        } catch {}
      }
    };

    (async () => {
      const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('screenshot_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true });
      for (const row of data || []) await handle(row);
    })();

    const channel = supabase
      .channel(`screenshot-requests-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'screenshot_requests', filter: `user_id=eq.${userId}` },
        (payload) => handle(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
