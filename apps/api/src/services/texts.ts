import type { Lang, SubOrderStatus } from '@taptym/shared';
import { get } from '../db.ts';

type Tr = Record<Lang, string>;

const STATUS: Record<SubOrderStatus, Tr> = {
  new: { ru: 'принят', ky: 'кабыл алынды', uz: 'qabul qilindi', kk: 'қабылданды' },
  confirmed: { ru: 'подтверждён магазином', ky: 'дүкөн ырастады', uz: "do'kon tasdiqladi", kk: 'дүкен растады' },
  assembling: { ru: 'собирается', ky: 'чогултулууда', uz: "yig'ilmoqda", kk: 'жиналуда' },
  ready: { ru: 'готов к отправке', ky: 'жөнөтүүгө даяр', uz: "jo'natishga tayyor", kk: 'жөнелтуге дайын' },
  in_delivery: { ru: 'в пути', ky: 'жолдо', uz: "yo'lda", kk: 'жолда' },
  delivered: { ru: 'доставлен', ky: 'жеткирилди', uz: 'yetkazildi', kk: 'жеткізілді' },
  cancelled: { ru: 'отменён', ky: 'жокко чыгарылды', uz: 'bekor qilindi', kk: 'бас тартылды' },
  rejected: { ru: 'отклонён магазином', ky: 'дүкөн четке какты', uz: "do'kon rad etdi", kk: 'дүкен қабылдамады' },
};

const TEXTS = {
  orderStatus: { ru: 'Заказ {n} {status}', ky: '{n} буйрутма: {status}', uz: '{n} buyurtma: {status}', kk: '{n} тапсырысы: {status}' },
  paidTitle: { ru: 'Оплата получена', ky: 'Төлөм алынды', uz: "To'lov qabul qilindi", kk: 'Төлем алынды' },
  paidBody: {
    ru: 'Заказ {n} оплачен. Мы передали его магазинам.',
    ky: '{n} буйрутма төлөндү. Биз аны дүкөндөргө өткөрдүк.',
    uz: "{n} buyurtma to'landi. Uni do'konlarga topshirdik.",
    kk: '{n} тапсырысы төленді. Біз оны дүкендерге жібердік.',
  },
  coinsTitle: { ru: '+{c} монет', ky: '+{c} тыйын', uz: '+{c} tanga', kk: '+{c} тиын' },
  cashbackBody: {
    ru: 'Кешбэк за заказ {n}. Тратьте на следующие покупки.',
    ky: '{n} буйрутма үчүн кешбэк. Кийинки сатып алууларда колдонуңуз.',
    uz: '{n} buyurtma uchun keshbek. Keyingi xaridlarda ishlating.',
    kk: '{n} тапсырысы үшін кешбэк. Келесі сатып алуларда жұмсаңыз.',
  },
  referralTitle: { ru: '+{c} монет за друга', ky: 'Дос үчүн +{c} тыйын', uz: "Do'st uchun +{c} tanga", kk: 'Дос үшін +{c} тиын' },
  referralBody: {
    ru: 'Ваш друг сделал первый заказ.',
    ky: 'Досуңуз биринчи буйрутмасын берди.',
    uz: "Do'stingiz birinchi buyurtmasini berdi.",
    kk: 'Досыңыз алғашқы тапсырысын жасады.',
  },
  giftBody: { ru: 'Подарок от Taptym', ky: 'Taptym тартуусу', uz: "Taptym'dan sovg'a", kk: 'Taptym сыйлығы' },
  supportReply: { ru: 'Ответ поддержки', ky: 'Колдоо кызматынын жообу', uz: "Qo'llab-quvvatlash javobi", kk: 'Қолдау қызметінің жауабы' },
} satisfies Record<string, Tr>;

export function userLang(userId: number): Lang {
  const l = get<{ lang: string }>('SELECT lang FROM users WHERE id = ?', userId)?.lang;
  return l === 'ky' || l === 'uz' || l === 'kk' ? l : 'ru';
}

export function tr(lang: Lang, key: keyof typeof TEXTS, vars: Record<string, string | number> = {}): string {
  let s: string = TEXTS[key][lang] ?? TEXTS[key].ru;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function statusWord(lang: Lang, status: SubOrderStatus): string {
  return STATUS[status][lang] ?? STATUS[status].ru;
}
