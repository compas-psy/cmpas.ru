/**
 * CMPAS Icon System — Notes & Actions
 *
 * Stroke-based, monochrome, --forest-800 default color.
 * Consistent: viewBox 24x24, strokeWidth 1.75, round caps/joins.
 *
 * Usage:
 *   <IconRequest className="w-5 h-5" />
 *   <IconRequest className="w-5 h-5 text-forest-700" />  // active
 */

import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const defaults = (props: IconProps) => ({
  xmlns: 'http://www.w3.org/2000/svg' as const,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: props.strokeWidth ?? 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: props.size ?? undefined,
  height: props.size ?? undefined,
  ...props,
  className: `shrink-0 ${props.className ?? ''}`.trim(),
});

// ─── Note Block Icons ────────────────────────────────────────

/** Запрос — crosshair/target */
export function IconRequest(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}

/** Анамнез — clipboard with list */
export function IconAnamnesis(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M9 3h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3Z" />
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  );
}

/** Наблюдение — eye */
export function IconObservation(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M2.5 12C4 7.5 7.5 5 12 5s8 2.5 9.5 7c-1.5 4.5-5 7-9.5 7s-8-2.5-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Интервенция — wand/tool */
export function IconIntervention(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="m15 4 5 5-11 11H4v-5L15 4Z" />
      <path d="m13.5 6.5 4 4" />
      <path d="M20 7 17 4" />
    </svg>
  );
}

/** Ресурсы — open book */
export function IconResources(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M4 4.5C4 3.67 4.67 3 5.5 3H9c1.1 0 2 .5 3 1.5 1-.5 1.9-1.5 3-1.5h3.5c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5H15c-1.1 0-2 .5-3 1.5-1-1-1.9-1.5-3-1.5H5.5C4.67 19 4 18.33 4 17.5v-13Z" />
      <path d="M12 4.5V20" />
    </svg>
  );
}

/** Динамика — trend up */
export function IconDynamics(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <polyline points="4 18 9 12 13 15 20 6" />
      <polyline points="16 6 20 6 20 10" />
    </svg>
  );
}

/** Домашнее задание — pencil + paper */
export function IconHomework(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}

/** Следующий шаг — arrow right in circle */
export function IconNextStep(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="10 8 14 12 10 16" />
    </svg>
  );
}

/** Приватные — lock */
export function IconPrivate(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

/** Для клиента — user with share */
export function IconForClient(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="10" cy="8" r="4" />
      <path d="M10 14c-4 0-7 2-7 4v1h10" />
      <circle cx="19" cy="16" r="2" />
      <path d="M19 14v-1" />
      <path d="M19 18v1" />
    </svg>
  );
}

/** Цитата */
export function IconQuote(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M10 8H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1l-1 4" />
      <path d="M20 8h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1l-1 4" />
    </svg>
  );
}

/** Гипотеза — lightbulb */
export function IconHypothesis(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3Z" />
    </svg>
  );
}


// ─── Action Icons ────────────────────────────────────────────

/** Поиск */
export function IconSearch(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  );
}

/** Добавить */
export function IconAdd(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

/** Фильтр */
export function IconFilter(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <polygon points="3 4 21 4 14 12.5 14 18 10 20 10 12.5 3 4" />
    </svg>
  );
}

/** Импорт */
export function IconImport(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M12 3v12" />
      <polyline points="8 11 12 15 16 11" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Экспорт */
export function IconExport(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M12 15V3" />
      <polyline points="8 7 12 3 16 7" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Поделиться */
export function IconShare(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <line x1="8.3" y1="10.9" x2="15.7" y2="7.1" />
      <line x1="8.3" y1="13.1" x2="15.7" y2="16.9" />
    </svg>
  );
}

/** Архив */
export function IconArchive(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  );
}

/** Удалить */
export function IconDelete(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M4 6h16" />
      <path d="M6 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
      <path d="M9 3h6" />
      <line x1="10" y1="10" x2="10" y2="16" />
      <line x1="14" y1="10" x2="14" y2="16" />
    </svg>
  );
}

/** Сохранить */
export function IconSave(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <polyline points="14 3 14 8 8 8" />
      <rect x="7" y="14" width="10" height="6" rx="1" />
    </svg>
  );
}

/** Закрыть */
export function IconClose(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** Назад */
export function IconBack(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <polyline points="14 18 8 12 14 6" />
    </svg>
  );
}

/** Микрофон */
export function IconMic(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

/** Вложение / скрепка */
export function IconAttach(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M15.5 3.5a3.5 3.5 0 0 1 0 5l-9 9a2.5 2.5 0 0 1-3.5-3.5l9-9a1.5 1.5 0 0 1 2 2l-7 7" />
    </svg>
  );
}

/** Теги */
export function IconTags(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M3 6.5V3h3.5L20 16.5 16.5 20 3 6.5Z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  );
}

/** Меню «ещё» */
export function IconMoreMenu(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Синхронизация */
export function IconSync(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <polyline points="4 10 1 7 4 4" />
      <path d="M1 7h15a5 5 0 0 1 5 5" />
      <polyline points="20 14 23 17 20 20" />
      <path d="M23 17H8a5 5 0 0 1-5-5" />
    </svg>
  );
}

/** Открыть встречу */
export function IconOpenMeeting(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M10 9l4 3-4 3V9Z" />
    </svg>
  );
}

/** Отметить оплату */
export function IconMarkPayment(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <path d="M9 15h2" />
    </svg>
  );
}

/** Форматирование текста (Aa) */
export function IconTextFormat(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <path d="M6 18 10 6h4l4 12" />
      <path d="M7.5 14h9" />
    </svg>
  );
}

/** Список */
export function IconList(props: IconProps) {
  return (
    <svg {...defaults(props)}>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── Icon Map (for dynamic usage) ────────────────────────────

export const NOTE_BLOCK_ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  request: IconRequest,
  anamnesis: IconAnamnesis,
  observation: IconObservation,
  intervention: IconIntervention,
  resources: IconResources,
  dynamics: IconDynamics,
  homework: IconHomework,
  next_step: IconNextStep,
  private: IconPrivate,
  for_client: IconForClient,
  quote: IconQuote,
  hypothesis: IconHypothesis,
};
