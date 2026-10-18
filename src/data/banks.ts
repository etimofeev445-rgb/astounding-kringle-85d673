export interface Bank {
  id: string
  name: string
  short: string
  color: string
  mfo: string
  edrpou: string
  hotline: string
  site: string
  app?: string
  state?: boolean
  tags: string[]
}

// Довідкові дані про найбільші банки України. Порожній hotline — номер
// не вказуємо, користувач переходить на сайт банку.
export const banks: Bank[] = [
  { id: 'privat', name: 'ПриватБанк', short: 'П', color: '#5aa02c', mfo: '305299', edrpou: '14360570', hotline: '3700', site: 'https://privatbank.ua', state: true, tags: ['державний', 'приват24', 'картки'] },
  { id: 'mono', name: 'monobank', short: 'm', color: '#1c1c1c', mfo: '322001', edrpou: '21133352', hotline: '0 800 205 205', site: 'https://monobank.ua', tags: ['універсал', 'онлайн', 'картки'] },
  { id: 'oschad', name: 'Ощадбанк', short: 'О', color: '#0f8a4f', mfo: '300465', edrpou: '00032129', hotline: '0 800 210 800', site: 'https://www.oschadbank.ua', state: true, tags: ['державний', 'пенсії', 'виплати'] },
  { id: 'pumb', name: 'ПУМБ', short: 'П', color: '#e4002b', mfo: '334851', edrpou: '14282829', hotline: '0 800 501 275', site: 'https://about.pumb.ua', tags: ['бізнес', 'картки'] },
  { id: 'raif', name: 'Райффайзен Банк', short: 'R', color: '#fee600', mfo: '380805', edrpou: '14305909', hotline: '0 800 505 770', site: 'https://raiffeisen.ua', tags: ['іноземний', 'бізнес'] },
  { id: 'ukrsib', name: 'УкрСиббанк', short: 'У', color: '#00915a', mfo: '351005', edrpou: '09807750', hotline: '729', site: 'https://my.ukrsibbank.com', tags: ['bnp paribas', 'іноземний'] },
  { id: 'abank', name: 'А-Банк', short: 'А', color: '#00a651', mfo: '307770', edrpou: '14360080', hotline: '', site: 'https://a-bank.com.ua', tags: ['онлайн', 'картки'] },
  { id: 'sense', name: 'Sense Bank', short: 'S', color: '#e30613', mfo: '300346', edrpou: '23494714', hotline: '', site: 'https://sensebank.ua', state: true, tags: ['державний', 'картки'] },
  { id: 'ukrgas', name: 'Укргазбанк', short: 'Г', color: '#3a9a3e', mfo: '320478', edrpou: '23697280', hotline: '0 800 309 000', site: 'https://www.ukrgasbank.com', state: true, tags: ['державний', 'еко-банк'] },
  { id: 'ukreximbank', name: 'Укрексімбанк', short: 'Е', color: '#005baa', mfo: '322313', edrpou: '00032112', hotline: '', site: 'https://www.eximb.com', state: true, tags: ['державний', 'зовнішня торгівля'] },
  { id: 'otp', name: 'ОТП Банк', short: 'O', color: '#52ae30', mfo: '300528', edrpou: '21685166', hotline: '', site: 'https://www.otpbank.com.ua', tags: ['іноземний', 'кредити'] },
  { id: 'credit', name: 'Креді Агріколь', short: 'C', color: '#007461', mfo: '300614', edrpou: '14361575', hotline: '0 800 30 5555', site: 'https://credit-agricole.ua', tags: ['іноземний', 'агро'] },
]
