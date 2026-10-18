import type { Tr } from '../lib/i18n'

// Telegram groups & channels by country, shown on the Telegram screen.
export type TgChannel = { handle: string; title: string }
export type TgCountry = { flag: string; name: Tr; channels: TgChannel[] }

export const TG_COUNTRIES: TgCountry[] = [
  {
    flag: '🇵🇱',
    name: { uk: 'Польща', ru: 'Польша' },
    channels: [
      { handle: 'pracavpolsku', title: 'Робота в Польщі' },
      { handle: 'workinpolandi', title: 'Work in Poland' },
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
    ],
  },
  {
    flag: '🇩🇪',
    name: { uk: 'Німеччина', ru: 'Германия' },
    channels: [
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
      { handle: 'pracavpolsku', title: 'Робота' },
      { handle: 'europeservicepl', title: 'Europe Service' },
    ],
  },
  {
    flag: '🇨🇿',
    name: { uk: 'Чехія', ru: 'Чехия' },
    channels: [
      { handle: 'dobra_prace', title: 'Добра праця' },
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
      { handle: 'europeservicepl', title: 'Europe Service' },
    ],
  },
  {
    flag: '🇸🇰',
    name: { uk: 'Словаччина', ru: 'Словакия' },
    channels: [
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
      { handle: 'ukrajincivsk', title: 'Українці в СК' },
      { handle: 'slovachyna_pidtrymka', title: 'Підтримка' },
    ],
  },
  {
    flag: '🇮🇹',
    name: { uk: 'Італія', ru: 'Италия' },
    channels: [
      { handle: 'dodomu_italia_ucraina', title: 'Додому Італія' },
      { handle: 'italia_info', title: 'Italia Info' },
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
    ],
  },
  {
    flag: '🇭🇺',
    name: { uk: 'Угорщина', ru: 'Венгрия' },
    channels: [
      { handle: 'hungary_ukr', title: 'Українці в Угорщині' },
      { handle: 'dopomoga_hungary', title: 'Допомога' },
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
    ],
  },
  {
    flag: '🇧🇬',
    name: { uk: 'Болгарія', ru: 'Болгария' },
    channels: [{ handle: 'helpukrainiansjooble', title: 'Jooble' }],
  },
  {
    flag: '🌍',
    name: { uk: 'Загальні', ru: 'Общие' },
    channels: [
      { handle: 'helpukrainiansjooble', title: 'Jooble' },
      { handle: 'outjob', title: 'Робота за кордоном' },
      { handle: 'jobforukrainians', title: 'JOB for Ukrainians' },
      { handle: 'europeservicepl', title: 'Europe Service' },
    ],
  },
]
