import { messages as ko, logs as koLogs } from './ko.ts'
import { messages as en, logs as enLogs } from './en.ts'
import { messages as tw, logs as twLogs } from './zh-TW.ts'
import { messages as cn, logs as cnLogs } from './zh-CN.ts'
import type { Dict, Lang } from './types.ts'

export const I18N = { ko, en, 'zh-TW': tw, 'zh-CN': cn } satisfies Record<
  Lang,
  Dict
>
export const LOGS = {
  ko: koLogs,
  en: enLogs,
  'zh-TW': twLogs,
  'zh-CN': cnLogs,
} satisfies Record<Lang, Dict>
