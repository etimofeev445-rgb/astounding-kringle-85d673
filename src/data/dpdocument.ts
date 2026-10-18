import type { Tr } from '../lib/i18n'

export interface DpCountry {
  id: string
  name: Tr
  flag: string
  offices: { city: string; address: string }[]
}

// Центри «Паспортного сервісу» ДП «Документ» (за даними pasport.org.ua, жовтень 2026).
// Адреси можуть змінюватися — актуальний перелік на сайті підприємства.
export const DP_SITE = 'https://pasport.org.ua/centers'
export const DP_PHONE = '+38 (044) 597-87-77'

export const dpCountries: DpCountry[] = [
  {
    id: 'ua', name: { uk: 'Україна', ru: 'Украина' }, flag: '🇺🇦',
    offices: [
      { city: 'Київ', address: 'пл. Галицька, 3, ТЦ «Україна», 3 поверх' },
      { city: 'Київ', address: 'пр. М. Бажана, 38' },
      { city: 'Київ', address: 'просп. Степана Бандери, 23' },
      { city: 'Київ', address: 'пр-т Європейського Союзу, 47' },
      { city: 'Київ', address: 'вул. Генерала Алмазова, 11' },
      { city: 'Київ', address: 'вул. Митрополита А. Шептицького, 4А' },
      { city: 'Вишневе', address: 'вул. Київська, 2л' },
      { city: 'Львів', address: 'вул. Юліуша Словацького, 1' },
      { city: 'Одеса', address: 'вул. Європейська, 27/1' },
      { city: 'Дніпро', address: 'узвіз Крутогірний, 33' },
      { city: 'Харків', address: 'проспект Науки, 62' },
    ],
  },
  {
    id: 'pl', name: { uk: 'Польща', ru: 'Польша' }, flag: '🇵🇱',
    offices: [
      { city: 'Варшава', address: 'Al. Jerozolimskie 179, 02-222, ТРЦ Blue City, 2 поверх' },
      { city: 'Вроцлав', address: 'plac Grunwaldzki 22, 50-363' },
      { city: 'Краків', address: 'Pawia 5, 31-154, ТЦ Galeria Krakowska' },
      { city: 'Гданськ', address: 'Aleja Grunwaldzka 415, 80-309' },
    ],
  },
  {
    id: 'de', name: { uk: 'Німеччина', ru: 'Германия' }, flag: '🇩🇪',
    offices: [
      { city: 'Берлін', address: 'Am Treptower Park 14, 12435' },
      { city: 'Кельн', address: 'Händelstraße 25-29, 50674' },
      { city: 'Мюнхен', address: 'Heinrich-Wieland-Straße 5, 81735' },
    ],
  },
  {
    id: 'cz', name: { uk: 'Чехія', ru: 'Чехия' }, flag: '🇨🇿',
    offices: [{ city: 'Прага', address: 'Michelská 1552/58, 141 00 Praha 4' }],
  },
  {
    id: 'sk', name: { uk: 'Словаччина', ru: 'Словакия' }, flag: '🇸🇰',
    offices: [{ city: 'Братислава', address: 'Prievozská 5434/6A' }],
  },
  {
    id: 'si', name: { uk: 'Словенія', ru: 'Словения' }, flag: '🇸🇮',
    offices: [{ city: 'Любляна', address: 'Leskoškova cesta 12' }],
  },
  {
    id: 'es', name: { uk: 'Іспанія', ru: 'Испания' }, flag: '🇪🇸',
    offices: [
      { city: 'Мадрид', address: 'Blvr. de José Prat, 35, Vicálvaro, 28032, ТЦ Valdebernardo, 2 поверх' },
      { city: 'Валенсія', address: 'Av. de Pius XII, 2, local 117, Campanar' },
    ],
  },
  {
    id: 'it', name: { uk: 'Італія', ru: 'Италия' }, flag: '🇮🇹',
    offices: [{ city: 'Мілан', address: 'Via Eugenio Curiel, 25, 20089 Rozzano, ТЦ Fiordaliso' }],
  },
  {
    id: 'bg', name: { uk: 'Болгарія', ru: 'Болгария' }, flag: '🇧🇬',
    offices: [{ city: 'Варна', address: 'бул. Владислав Варненчик, 186' }],
  },
  {
    id: 'md', name: { uk: 'Молдова', ru: 'Молдова' }, flag: '🇲🇩',
    offices: [{ city: 'Кишинів', address: 'Bd. Ştefan cel Mare şi Sfânt, 8' }],
  },
  {
    id: 'gb', name: { uk: 'Велика Британія', ru: 'Великобритания' }, flag: '🇬🇧',
    offices: [{ city: 'Лондон', address: 'Ground Floor, The Foundry, 8-15 Dereham Place, EC2A 3HJ' }],
  },
  {
    id: 'ca', name: { uk: 'Канада', ru: 'Канада' }, flag: '🇨🇦',
    offices: [{ city: 'Торонто', address: '99 Six Point Rd, Etobicoke, ON M8Z 2X3' }],
  },
]
