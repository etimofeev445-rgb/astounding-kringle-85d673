import type { Tr } from './i18n'

export type Screen = 'home' | 'search' | 'rates' | 'banks' | 'docs' | 'calc' | 'calendar' | 'cards' | 'np' | 'telegram' | 'topup' | 'menu' | 'ads' | 'cart' | 'news' | 'info' | 'map' | 'store'

export type Go = (s: Screen) => void

export const SCREENS: { id: Screen; title: Tr; hint: Tr; emoji: string }[] = [
  {
    id: 'map', emoji: '🗺',
    title: { uk: 'Карта', ru: 'Карта' },
    hint: { uk: 'Каталог магазинів, салонів, авто та послуг', ru: 'Каталог магазинов, салонов, авто и услуг' },
  },
  {
    id: 'news', emoji: '📰',
    title: { uk: 'Новини', ru: 'Новости' },
    hint: { uk: 'Фінанси, технології, Telegram-канали', ru: 'Финансы, технологии, Telegram-каналы' },
  },
  {
    id: 'ads', emoji: '📢',
    title: { uk: 'Оголошення', ru: 'Объявления' },
    hint: { uk: 'Купити, продати, запропонувати', ru: 'Купить, продать, предложить' },
  },
  {
    id: 'rates', emoji: '💱',
    title: { uk: 'Курс валют', ru: 'Курс валют' },
    hint: { uk: 'НБУ, ПриватБанк, monobank', ru: 'НБУ, ПриватБанк, monobank' },
  },
  {
    id: 'banks', emoji: '🏦',
    title: { uk: 'Банки України', ru: 'Банки Украины' },
    hint: { uk: 'МФО, ЄДРПОУ, гарячі лінії', ru: 'МФО, ЕГРПОУ, горячие линии' },
  },
  {
    id: 'docs', emoji: '📄',
    title: { uk: 'ДП Документи', ru: 'ГП Документы' },
    hint: { uk: 'Країни, міста та адреси центрів', ru: 'Страны, города и адреса центров' },
  },
  {
    id: 'calc', emoji: '🧮',
    title: { uk: 'Калькулятор', ru: 'Калькулятор' },
    hint: { uk: 'Звичайний, ПДВ, депозит, кредит', ru: 'Обычный, НДС, депозит, кредит' },
  },
  {
    id: 'np', emoji: '📦',
    title: { uk: 'Нова пошта', ru: 'Новая почта' },
    hint: { uk: 'Відстеження ТТН, відділення', ru: 'Отслеживание ТТН, отделения' },
  },
  {
    id: 'calendar', emoji: '📅',
    title: { uk: 'Календар', ru: 'Календарь' },
    hint: { uk: 'Свята та вихідні', ru: 'Праздники и выходные' },
  },
  {
    id: 'cards', emoji: '💳',
    title: { uk: 'Відкрити карту', ru: 'Открыть карту' },
    hint: { uk: 'Kraken, Simple, Kolo', ru: 'Kraken, Simple, Kolo' },
  },
  {
    id: 'search', emoji: '🔎',
    title: { uk: 'Пошук', ru: 'Поиск' },
    hint: { uk: 'По всьому застосунку', ru: 'По всему приложению' },
  },
  {
    id: 'info', emoji: 'ℹ️',
    title: { uk: 'Інформація', ru: 'Информация' },
    hint: { uk: 'Про нас, підтримка, політика, умови', ru: 'О нас, поддержка, политика, условия' },
  },
]
