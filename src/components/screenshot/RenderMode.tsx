import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Render mode (?render=1): strips floating overlays, opens the requested tab
 * and marks the document ready once the page has settled, so the headless
 * screenshot worker knows exactly when to capture.
 */
const RENDER_STYLE_ID = 'render-mode-style';

const TAB_KEYWORDS: Array<{ tab: string; words: string[] }> = [
  { tab: 'tasks', words: ['task', 'todo', 'to do', 'board', 'kanban', 'დავალებ', 'ამოცან', 'დაფა', 'задач', 'доск', 'tablero', 'tarea'] },
  { tab: 'calendar', words: ['calendar', 'agenda', 'schedule', 'booking', 'კალენდ', 'ჯავშნ', 'календ', 'расписан', 'calendario'] },
  { tab: 'crm', words: ['crm', 'customer', 'client', 'contact', 'კლიენტ', 'მომხმარებ', 'контакт', 'клиент', 'cliente'] },
  { tab: 'statistics', words: ['statistic', 'stats', 'analytic', 'report', 'სტატისტ', 'ანალიტ', 'статист', 'аналит', 'отчет', 'estadist', 'informe'] },
  { tab: 'business', words: ['business', 'booking page', 'public page', 'ბიზნეს', 'бизнес', 'negocio'] },
];

function resolveTab(hint?: string | null): string | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  if (TAB_KEYWORDS.some(({ tab }) => tab === h)) return h;
  for (const { tab, words } of TAB_KEYWORDS) {
    if (words.some((w) => h.includes(w))) return tab;
  }
  return null;
}

export function RenderMode() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('render') !== '1') return;

    const root = document.documentElement;
    root.setAttribute('data-render-mode', 'true');

    if (!document.getElementById(RENDER_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = RENDER_STYLE_ID;
      style.textContent = `
        [data-render-mode="true"] #chat-floating-root,
        [data-render-mode="true"] #chat-overlay,
        [data-render-mode="true"] .chat-icon-root,
        [data-render-mode="true"] .dynamic-island-root,
        [data-render-mode="true"] [data-screenshot-hide] {
          display: none !important;
        }
        [data-render-mode="true"] * {
          animation: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const hint = resolveTab(params.get('hint'));
    const popup = params.get('popup');
    const timers: number[] = [];

    if (hint) {
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: { tab: hint } }));
        }, 900)
      );
    }

    if (popup === 'profile') {
      timers.push(
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-dashboard-profile'));
        }, 1800)
      );
    }

    if (popup === 'add_task') {
      timers.push(
        window.setTimeout(() => {
          (document.querySelector('[data-tutorial="tasks-add-btn"]') as HTMLElement | null)?.click();
        }, 2000)
      );
    }

    // Signal readiness after data + charts have had time to paint.
    timers.push(
      window.setTimeout(() => {
        document.documentElement.setAttribute('data-render-ready', 'true');
      }, popup ? 6500 : 5000)
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [location.search]);

  return null;
}
