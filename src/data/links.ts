import type { Tr } from '../lib/i18n'

// External links shown on the home screen.
export const FLIXBUS_URL = 'https://www.flixbus.ua'

// Payment cards shown on the «Відкрити карту» screen.
export const CARDS: {
  id: 'kraken' | 'simple' | 'kolo'
  name: string
  hint: Tr
  url: string
}[] = [
  { id: 'kraken', name: 'Kraken', hint: { uk: 'Krak — криптокарта та гаманець', ru: 'Krak — криптокарта и кошелёк' }, url: 'https://krak.app/@Goldstar' },
  { id: 'simple', name: 'Simple', hint: { uk: 'Simple — мультивалютна карта', ru: 'Simple — мультивалютная карта' }, url: 'https://join.simple.app/goldstar' },
  { id: 'kolo', name: 'Kolo', hint: { uk: 'Kolo — криптокарта Visa', ru: 'Kolo — криптокарта Visa' }, url: 'https://get.kolo.xyz/p731910' },
]

// Delivery and taxi services shown in the «Меню» screen.
export const SERVICES: {
  id: 'glovo' | 'wolt' | 'bolt' | 'uber'
  name: string
  hint: Tr
  url: string
  bg: string
  fg: string
}[] = [
  { id: 'glovo', name: 'Glovo', hint: { uk: 'Доставка їжі та продуктів', ru: 'Доставка еды и продуктов' }, url: 'https://glovoapp.com/ua/uk/', bg: '#ffc244', fg: '#00a082' },
  { id: 'wolt', name: 'Wolt', hint: { uk: 'Доставка з ресторанів і магазинів', ru: 'Доставка из ресторанов и магазинов' }, url: 'https://wolt.com/uk/ukr', bg: '#009de0', fg: '#ffffff' },
  { id: 'bolt', name: 'Bolt', hint: { uk: 'Таксі, самокати та доставка', ru: 'Такси, самокаты и доставка' }, url: 'https://bolt.eu/uk-ua/', bg: '#34d186', fg: '#0b1f14' },
  { id: 'uber', name: 'Uber', hint: { uk: 'Таксі по місту', ru: 'Такси по городу' }, url: 'https://www.uber.com/ua/uk/', bg: '#000000', fg: '#ffffff' },
]
