import { createTranslator, pluralRu, type Dict, type Lang } from '@taptym/shared';
import { useCallback } from 'react';
import { useApp } from './lib/store';

const dict = {
  // tabs
  tab_home: { ru: 'Главная', ky: 'Башкы', uz: 'Asosiy', kk: 'Басты' },
  tab_search: { ru: 'Поиск', ky: 'Издөө', uz: 'Qidiruv', kk: 'Іздеу' },
  tab_cart: { ru: 'Корзина', ky: 'Себет', uz: 'Savat', kk: 'Себет' },
  tab_orders: { ru: 'Заказы', ky: 'Заказдар', uz: 'Buyurtma', kk: 'Тапсырыс' },
  tab_profile: { ru: 'Профиль', ky: 'Профиль', uz: 'Profil', kk: 'Профиль' },

  // common
  back: { ru: 'Назад', ky: 'Артка', uz: 'Orqaga', kk: 'Артқа' },
  close: { ru: 'Закрыть', ky: 'Жабуу', uz: 'Yopish', kk: 'Жабу' },
  edit: { ru: 'Изменить', ky: 'Өзгөртүү', uz: "O'zgartirish", kk: 'Өзгерту' },
  save: { ru: 'Сохранить', ky: 'Сактоо', uz: 'Saqlash', kk: 'Сақтау' },
  cancel: { ru: 'Отмена', ky: 'Жокко чыгаруу', uz: 'Bekor qilish', kk: 'Бас тарту' },
  done: { ru: 'Готово', ky: 'Даяр', uz: 'Tayyor', kk: 'Дайын' },
  retry: { ru: 'Повторить', ky: 'Кайталоо', uz: 'Qayta urinish', kk: 'Қайталау' },
  all: { ru: 'Все', ky: 'Баары', uz: 'Hammasi', kk: 'Барлығы' },
  show_more: { ru: 'Показать ещё', ky: 'Дагы көрсөтүү', uz: "Yana ko'rsatish", kk: 'Тағы көрсету' },
  copy: { ru: 'Копировать', ky: 'Көчүрүү', uz: 'Nusxalash', kk: 'Көшіру' },
  copied: { ru: 'Скопировано', ky: 'Көчүрүлдү', uz: 'Nusxalandi', kk: 'Көшірілді' },
  share: { ru: 'Поделиться', ky: 'Бөлүшүү', uz: 'Ulashish', kk: 'Бөлісу' },
  from_price: { ru: 'от {p}', ky: '{p} баштап', uz: '{p} dan', kk: '{p} бастап' },
  pcs: { ru: 'шт', ky: 'даана', uz: 'dona', kk: 'дана' },
  delete: { ru: 'Удалить', ky: 'Өчүрүү', uz: "O'chirish", kk: 'Жою' },
  error_title: { ru: 'Что-то пошло не так', ky: 'Бир нерсе туура эмес болду', uz: "Nimadir noto'g'ri ketdi", kk: 'Бірдеңе дұрыс болмады' },
  ad: { ru: 'Реклама', ky: 'Жарнама', uz: 'Reklama', kk: 'Жарнама' },
  new_badge: { ru: 'Новый', ky: 'Жаңы', uz: 'Yangi', kk: 'Жаңа' },
  login_required: { ru: 'Войдите, чтобы продолжить', ky: 'Улантуу үчүн кириңиз', uz: 'Davom etish uchun kiring', kk: 'Жалғастыру үшін кіріңіз' },
  login_btn: { ru: 'Войти', ky: 'Кирүү', uz: 'Kirish', kk: 'Кіру' },

  // home
  deliver_to: { ru: 'Доставка', ky: 'Жеткирүү', uz: 'Yetkazish', kk: 'Жеткізу' },
  choose_address: { ru: 'Выберите адрес', ky: 'Даректи тандаңыз', uz: 'Manzilni tanlang', kk: 'Мекенжайды таңдаңыз' },
  notifications: { ru: 'Уведомления', ky: 'Билдирмелер', uz: 'Bildirishnomalar', kk: 'Хабарламалар' },
  search_placeholder: { ru: 'Ручка, дептер, qalam…', ky: 'Калем, дептер, ручка…', uz: 'Ruchka, daftar, qalam…', kk: 'Қалам, дәптер, ручка…' },
  back_to_school: { ru: 'Снова в школу', ky: 'Кайра мектепке', uz: 'Yana maktabga', kk: 'Қайта мектепке' },
  back_to_school_sub: { ru: 'Один тап — и весь список в корзине по самой низкой цене', ky: 'Бир басуу — бүт тизме эң арзан баада себетте', uz: "Bir bosish — butun ro'yxat eng arzon narxda savatda", kk: 'Бір басу — бүкіл тізім ең арзан бағамен себетте' },
  items_count: { ru: '{n} {n|позиция|позиции|позиций}', ky: '{n} буюм', uz: '{n} ta mahsulot', kk: '{n} тауар' },
  add_set: { ru: 'В корзину', ky: 'Себетке', uz: 'Savatga', kk: 'Себетке' },
  set_added: { ru: 'Добавили в корзину: {n} {n|товар|товара|товаров}', ky: 'Себетке кошулду: {n} товар', uz: "Savatga qo'shildi: {n} ta mahsulot", kk: 'Себетке қосылды: {n} тауар' },
  categories: { ru: 'Категории', ky: 'Категориялар', uz: 'Kategoriyalar', kk: 'Санаттар' },
  deals_now: { ru: 'Выгодно сейчас', ky: 'Азыр пайдалуу', uz: 'Hozir foydali', kk: 'Қазір тиімді' },
  popular: { ru: 'Популярное', ky: 'Популярдуу', uz: 'Ommabop', kk: 'Танымал' },
  stores_osh: { ru: 'Магазины Оша', ky: 'Оштун дүкөндөрү', uz: "O'sh do'konlari", kk: 'Ош дүкендері' },
  offers_n: { ru: '{n} предл.', ky: '{n} сунуш', uz: '{n} taklif', kk: '{n} ұсыныс' },
  promo_saved: { ru: 'Промокод {code} скопирован и применится в корзине', ky: '{code} промокоду көчүрүлдү, себетте колдонулат', uz: "{code} promokodi nusxalandi va savatda qo'llanadi", kk: '{code} промокоды көшірілді, себетте қолданылады' },

  // search
  recent: { ru: 'Недавние запросы', ky: 'Акыркы издөөлөр', uz: "So'nggi qidiruvlar", kk: 'Соңғы сұраулар' },
  clear: { ru: 'Очистить', ky: 'Тазалоо', uz: 'Tozalash', kk: 'Тазалау' },
  try_these: { ru: 'Попробуйте', ky: 'Байкап көрүңүз', uz: "Sinab ko'ring", kk: 'Көріңіз' },
  multilang_hint: { ru: 'Пишите как удобно: по-русски, по-кыргызски, по-узбекски — даже с ошибками', ky: 'Ыңгайлуу жазыңыз: орусча, кыргызча, өзбекче — катасы менен да болот', uz: "Qanday qulay bo'lsa yozing: ruscha, qirg'izcha, o'zbekcha — xato bilan ham", kk: 'Қалай ыңғайлы жазыңыз: орысша, қырғызша, өзбекше — қатемен де болады' },
  corrected: { ru: 'Показаны результаты по запросу «{q}»', ky: '«{q}» боюнча жыйынтыктар', uz: "«{q}» so'rovi bo'yicha natijalar", kk: '«{q}» сұрауы бойынша нәтижелер' },
  found_n: { ru: 'Найдено: {n}', ky: 'Табылды: {n}', uz: 'Topildi: {n}', kk: 'Табылды: {n}' },
  nothing_found: { ru: 'Ничего не нашли', ky: 'Эч нерсе табылган жок', uz: 'Hech narsa topilmadi', kk: 'Ештеңе табылмады' },
  nothing_found_tips: { ru: 'Проверьте написание, используйте более короткий запрос или загляните в категории', ky: 'Жазылышын текшериңиз, кыскараак сураңыз же категорияларды караңыз', uz: "Yozilishini tekshiring, qisqaroq so'rov yozing yoki kategoriyalarga qarang", kk: 'Жазылуын тексеріңіз, қысқарақ сұрау жазыңыз немесе санаттарды қараңыз' },
  words: { ru: 'Запросы', ky: 'Суроолор', uz: "So'rovlar", kk: 'Сұраулар' },
  products: { ru: 'Товары', ky: 'Товарлар', uz: 'Mahsulotlar', kk: 'Тауарлар' },
  sort_relevance: { ru: 'Подходящие', ky: 'Ылайыктуу', uz: 'Eng mos', kk: 'Сәйкес' },
  sort_popular: { ru: 'Популярные', ky: 'Популярдуу', uz: 'Ommabop', kk: 'Танымал' },
  sort_price_asc: { ru: 'Дешевле', ky: 'Арзаныраак', uz: 'Arzonroq', kk: 'Арзанырақ' },
  sort_price_desc: { ru: 'Дороже', ky: 'Кымбатыраак', uz: 'Qimmatroq', kk: 'Қымбатырақ' },
  sort_rating: { ru: 'Высокий рейтинг', ky: 'Жогорку рейтинг', uz: 'Yuqori reyting', kk: 'Жоғары рейтинг' },
  sort_savings: { ru: 'Макс. выгода', ky: 'Көп үнөм', uz: 'Katta tejam', kk: 'Көп үнем' },
  sort_new: { ru: 'Новинки', ky: 'Жаңылар', uz: 'Yangilar', kk: 'Жаңалар' },
  filters: { ru: 'Фильтры', ky: 'Чыпкалар', uz: 'Filtrlar', kk: 'Сүзгілер' },
  price_range: { ru: 'Цена, сом', ky: 'Баасы, сом', uz: "Narxi, so'm", kk: 'Бағасы, сом' },
  price_from: { ru: 'от', ky: 'баштап', uz: 'dan', kk: 'бастап' },
  price_to: { ru: 'до', ky: 'чейин', uz: 'gacha', kk: 'дейін' },
  in_stock_only: { ru: 'Только в наличии', ky: 'Бар болгондор гана', uz: 'Faqat mavjudlari', kk: 'Тек барлары' },
  deals_only: { ru: 'Только со скидкой', ky: 'Арзандатуу менен гана', uz: 'Faqat chegirmali', kk: 'Тек жеңілдікпен' },
  reset: { ru: 'Сбросить', ky: 'Тазалоо', uz: 'Tiklash', kk: 'Тазарту' },
  show_results: { ru: 'Показать товары', ky: 'Товарларды көрсөтүү', uz: "Mahsulotlarni ko'rsatish", kk: 'Тауарларды көрсету' },

  // product
  offers_in_stores: { ru: '{n} {n|предложение|предложения|предложений} в {m} {m|магазине|магазинах|магазинах}', ky: '{m} дүкөндө {n} сунуш', uz: "{m} do'konda {n} ta taklif", kk: '{m} дүкенде {n} ұсыныс' },
  savings_upto: { ru: 'Выгода до {x}', ky: '{x} чейин үнөм', uz: '{x} gacha tejam', kk: '{x} дейін үнем' },
  compare_prices: { ru: 'Цены в магазинах', ky: 'Дүкөндөрдөгү баалар', uz: "Do'konlardagi narxlar", kk: 'Дүкендердегі бағалар' },
  best_price: { ru: 'Выгоднее всего', ky: 'Эң пайдалуу', uz: 'Eng foydali', kk: 'Ең тиімді' },
  in_stock_n: { ru: 'В наличии: {n} шт', ky: 'Бар: {n} даана', uz: 'Mavjud: {n} dona', kk: 'Бар: {n} дана' },
  few_left: { ru: 'Осталось {n} шт', ky: '{n} даана калды', uz: '{n} dona qoldi', kk: '{n} дана қалды' },
  out_of_stock: { ru: 'Нет в наличии', ky: 'Жок', uz: 'Mavjud emas', kk: 'Жоқ' },
  today_badge: { ru: 'Сегодня', ky: 'Бүгүн', uz: 'Bugun', kk: 'Бүгін' },
  wholesale: { ru: 'от {n} шт — {p}', ky: '{n} даанадан — {p}', uz: '{n} donadan — {p}', kk: '{n} данадан — {p}' },
  add_to_cart: { ru: 'В корзину', ky: 'Себетке', uz: 'Savatga', kk: 'Себетке' },
  add_to_cart_for: { ru: 'В корзину за {p}', ky: '{p} — себетке', uz: '{p} — savatga', kk: '{p} — себетке' },
  in_cart_n: { ru: 'В корзине: {n}', ky: 'Себетте: {n}', uz: 'Savatda: {n}', kk: 'Себетте: {n}' },
  go_to_cart: { ru: 'Перейти в корзину', ky: 'Себетке өтүү', uz: "Savatga o'tish", kk: 'Себетке өту' },
  added_to_cart: { ru: 'Добавлено в корзину', ky: 'Себетке кошулду', uz: "Savatga qo'shildi", kk: 'Себетке қосылды' },
  description: { ru: 'Описание', ky: 'Сүрөттөмө', uz: 'Tavsif', kk: 'Сипаттама' },
  specs: { ru: 'Характеристики', ky: 'Мүнөздөмөлөр', uz: 'Xususiyatlar', kk: 'Сипаттамалар' },
  reviews: { ru: 'Отзывы', ky: 'Пикирлер', uz: 'Sharhlar', kk: 'Пікірлер' },
  reviews_n: { ru: '{n} {n|отзыв|отзыва|отзывов}', ky: '{n} пикир', uz: '{n} ta sharh', kk: '{n} пікір' },
  no_reviews: { ru: 'Отзывов пока нет — будьте первым', ky: 'Азырынча пикир жок — биринчи болуңуз', uz: "Hozircha sharh yo'q — birinchi bo'ling", kk: 'Әзірге пікір жоқ — бірінші болыңыз' },
  write_review: { ru: 'Написать отзыв', ky: 'Пикир жазуу', uz: 'Sharh yozish', kk: 'Пікір жазу' },
  similar: { ru: 'Похожие товары', ky: 'Окшош товарлар', uz: "O'xshash mahsulotlar", kk: 'Ұқсас тауарлар' },
  favorite: { ru: 'Избранное', ky: 'Тандалма', uz: 'Sevimli', kk: 'Таңдаулы' },
  favorite_added: { ru: 'Добавлено в избранное', ky: 'Тандалмаларга кошулду', uz: "Sevimlilarga qo'shildi", kk: 'Таңдаулыға қосылды' },
  favorite_removed: { ru: 'Убрано из избранного', ky: 'Тандалмалардан алынды', uz: 'Sevimlilardan olindi', kk: 'Таңдаулыдан алынды' },
  watch_video: { ru: 'Смотреть видео', ky: 'Видео көрүү', uz: "Videoni ko'rish", kk: 'Бейнені көру' },
  bought_at: { ru: 'Куплено в «{s}»', ky: '«{s}» дүкөнүнөн алынган', uz: "«{s}» do'konidan olingan", kk: '«{s}» дүкенінен алынған' },
  own_delivery: { ru: 'Своя доставка', ky: 'Өз жеткирүүсү', uz: "O'z yetkazishi", kk: 'Өз жеткізуі' },
  orders_done: { ru: '{n} {n|заказ|заказа|заказов}', ky: '{n} буйрутма', uz: '{n} ta buyurtma', kk: '{n} тапсырыс' },
  work_hours: { ru: 'Часы работы', ky: 'Иш убактысы', uz: 'Ish vaqti', kk: 'Жұмыс уақыты' },
  store_products: { ru: 'Товары магазина', ky: 'Дүкөндүн товарлары', uz: "Do'kon mahsulotlari", kk: 'Дүкен тауарлары' },

  // review
  your_rating: { ru: 'Ваша оценка', ky: 'Сиздин баа', uz: 'Sizning bahoingiz', kk: 'Сіздің бағаңыз' },
  review_placeholder: { ru: 'Что понравилось, что нет?', ky: 'Эмнеси жакты, эмнеси жакпады?', uz: 'Nima yoqdi, nima yoqmadi?', kk: 'Не ұнады, не ұнамады?' },
  add_photo: { ru: 'Фото', ky: 'Сүрөт', uz: 'Rasm', kk: 'Фото' },
  video_link: { ru: 'Ссылка на видео (необязательно)', ky: 'Видео шилтемеси (милдеттүү эмес)', uz: 'Video havolasi (ixtiyoriy)', kk: 'Бейне сілтемесі (міндетті емес)' },
  send: { ru: 'Отправить', ky: 'Жөнөтүү', uz: 'Yuborish', kk: 'Жіберу' },
  review_thanks: { ru: 'Спасибо! Отзыв опубликован', ky: 'Рахмат! Пикир жарыяланды', uz: 'Rahmat! Sharh chop etildi', kk: 'Рақмет! Пікір жарияланды' },
  uploading: { ru: 'Загружаем фото…', ky: 'Сүрөт жүктөлүүдө…', uz: 'Rasm yuklanmoqda…', kk: 'Фото жүктелуде…' },

  // cart
  cart_title: { ru: 'Корзина', ky: 'Себет', uz: 'Savat', kk: 'Себет' },
  cart_empty: { ru: 'Корзина пока пустая', ky: 'Себет азырынча бош', uz: "Savat hozircha bo'sh", kk: 'Себет әзірге бос' },
  cart_empty_sub: { ru: 'Найдите нужное — мы покажем, где дешевле', ky: 'Керектүүнү табыңыз — кайсы жерде арзан экенин көрсөтөбүз', uz: "Keraklisini toping — qayerda arzonligini ko'rsatamiz", kk: 'Қажеттіні табыңыз — қай жерде арзан екенін көрсетеміз' },
  to_shopping: { ru: 'За покупками', ky: 'Сатып алууга', uz: 'Xarid qilish', kk: 'Сатып алуға' },
  delivery: { ru: 'Доставка', ky: 'Жеткирүү', uz: 'Yetkazish', kk: 'Жеткізу' },
  dm_courier: { ru: 'Курьер Taptym', ky: 'Taptym курьери', uz: 'Taptym kuryeri', kk: 'Taptym курьері' },
  dm_supplier: { ru: 'Доставка магазина', ky: 'Дүкөндүн жеткирүүсү', uz: "Do'kon yetkazishi", kk: 'Дүкен жеткізуі' },
  dm_yandex: { ru: 'Яндекс Доставка', ky: 'Яндекс Жеткирүү', uz: 'Yandex Yetkazish', kk: 'Яндекс Жеткізу' },
  dm_pickup: { ru: 'Самовывоз', ky: 'Өзү алып кетүү', uz: 'Olib ketish', kk: 'Өзі алып кету' },
  eta_today: { ru: 'Сегодня', ky: 'Бүгүн', uz: 'Bugun', kk: 'Бүгін' },
  eta_tomorrow: { ru: 'Завтра', ky: 'Эртең', uz: 'Ertaga', kk: 'Ертең' },
  eta_pickup: { ru: 'Когда удобно', ky: 'Ыңгайлуу убакта', uz: 'Qulay vaqtda', kk: 'Ыңғайлы уақытта' },
  unavailable: { ru: 'Недоступно', ky: 'Жеткиликсиз', uz: 'Mavjud emas', kk: 'Қолжетімсіз' },
  free: { ru: 'Бесплатно', ky: 'Акысыз', uz: 'Bepul', kk: 'Тегін' },
  cheaper_found: { ru: 'Нашли дешевле: сэкономьте {x}', ky: 'Арзаныраак таптык: {x} үнөмдөңүз', uz: 'Arzonroq topdik: {x} tejang', kk: 'Арзанырақ таптық: {x} үнемдеңіз' },
  cheaper_found_sub: { ru: 'Те же товары в других магазинах Оша', ky: 'Ошол эле товарлар Оштун башка дүкөндөрүндө', uz: "Xuddi shu mahsulotlar O'shning boshqa do'konlarida", kk: 'Сол тауарлар Оштың басқа дүкендерінде' },
  apply_cheaper: { ru: 'Заменить', ky: 'Алмаштыруу', uz: 'Almashtirish', kk: 'Ауыстыру' },
  cheaper_applied: { ru: 'Готово! Вы сэкономили {x}', ky: 'Даяр! Сиз {x} үнөмдөдүңүз', uz: 'Tayyor! Siz {x} tejadingiz', kk: 'Дайын! Сіз {x} үнемдедіңіз' },
  promo_code: { ru: 'Промокод', ky: 'Промокод', uz: 'Promokod', kk: 'Промокод' },
  promo_placeholder: { ru: 'Введите код', ky: 'Кодду жазыңыз', uz: 'Kodni kiriting', kk: 'Кодты енгізіңіз' },
  promo_applied: { ru: 'Промокод применён: −{x}', ky: 'Промокод колдонулду: −{x}', uz: "Promokod qo'llandi: −{x}", kk: 'Промокод қолданылды: −{x}' },
  apply: { ru: 'Применить', ky: 'Колдонуу', uz: "Qo'llash", kk: 'Қолдану' },
  pay_with_coins: { ru: 'Оплатить монетами', ky: 'Тыйындар менен төлөө', uz: "Tangalar bilan to'lash", kk: 'Тиындармен төлеу' },
  coins_available: { ru: 'Спишем {n} из {b} монет (до 30% заказа)', ky: '{b} тыйындан {n} колдонулат (буйрутманын 30% чейин)', uz: '{b} tangadan {n} tasi ishlatiladi (30% gacha)', kk: '{b} тиыннан {n} қолданылады (30% дейін)' },
  coins_login: { ru: 'Войдите, чтобы платить монетами', ky: 'Тыйын менен төлөө үчүн кириңиз', uz: "Tangalar bilan to'lash uchun kiring", kk: 'Тиынмен төлеу үшін кіріңіз' },
  free_first_delivery: { ru: 'Первая доставка курьером Taptym — бесплатно', ky: 'Taptym курьеринин биринчи жеткирүүсү — акысыз', uz: 'Taptym kuryerining birinchi yetkazishi — bepul', kk: 'Taptym курьерінің алғашқы жеткізуі — тегін' },
  summary: { ru: 'Итого', ky: 'Жыйынтык', uz: 'Jami', kk: 'Барлығы' },
  items_sum: { ru: 'Товары ({n})', ky: 'Товарлар ({n})', uz: 'Mahsulotlar ({n})', kk: 'Тауарлар ({n})' },
  coins_used: { ru: 'Монетами', ky: 'Тыйындар менен', uz: 'Tangalar bilan', kk: 'Тиындармен' },
  total: { ru: 'К оплате', ky: 'Төлөөгө', uz: "To'lovga", kk: 'Төлеуге' },
  you_save: { ru: 'Вы экономите {x} по сравнению с самыми дорогими предложениями', ky: 'Эң кымбат сунуштарга салыштырмалуу {x} үнөмдөйсүз', uz: 'Eng qimmat takliflarga nisbatan {x} tejaysiz', kk: 'Ең қымбат ұсыныстармен салыстырғанда {x} үнемдейсіз' },
  coins_to_earn: { ru: '+{n} {n|монета|монеты|монет} за заказ', ky: 'Буйрутма үчүн +{n} тыйын', uz: 'Buyurtma uchun +{n} tanga', kk: 'Тапсырыс үшін +{n} тиын' },
  checkout: { ru: 'Оформить заказ', ky: 'Буйрутма берүү', uz: 'Buyurtma berish', kk: 'Тапсырыс беру' },
  remove: { ru: 'Убрать', ky: 'Алып салуу', uz: 'Olib tashlash', kk: 'Алып тастау' },
  stores_in_cart: { ru: 'Из {n} {n|магазина|магазинов|магазинов} — одним заказом', ky: '{n} дүкөндөн — бир буйрутма менен', uz: "{n} do'kondan — bitta buyurtmada", kk: '{n} дүкеннен — бір тапсырыспен' },

  // checkout
  checkout_title: { ru: 'Оформление', ky: 'Буйрутма берүү', uz: 'Rasmiylashtirish', kk: 'Рәсімдеу' },
  address: { ru: 'Адрес доставки', ky: 'Жеткирүү дареги', uz: 'Yetkazish manzili', kk: 'Жеткізу мекенжайы' },
  add_address: { ru: 'Добавить адрес', ky: 'Дарек кошуу', uz: "Manzil qo'shish", kk: 'Мекенжай қосу' },
  my_location: { ru: 'Моё местоположение', ky: 'Менин жайгашкан жерим', uz: 'Mening joylashuvim', kk: 'Менің орналасқан жерім' },
  locating: { ru: 'Определяем…', ky: 'Аныктап жатабыз…', uz: 'Aniqlanmoqda…', kk: 'Анықталуда…' },
  location_denied: { ru: 'Нет доступа к геолокации — выберите район из списка', ky: 'Геолокацияга уруксат жок — тизмеден районду тандаңыз', uz: "Geolokatsiyaga ruxsat yo'q — ro'yxatdan hududni tanlang", kk: 'Геолокацияға рұқсат жоқ — тізімнен ауданды таңдаңыз' },
  location_found: { ru: 'Нашли вас! Уточните дом и квартиру', ky: 'Сизди таптык! Үй жана батирди тактаңыз', uz: 'Sizni topdik! Uy va xonadonni aniqlang', kk: 'Сізді таптық! Үй мен пәтерді нақтылаңыз' },
  choose_district: { ru: 'Или выберите район Оша', ky: 'Же Оштун районун тандаңыз', uz: "Yoki O'sh hududini tanlang", kk: 'Немесе Ош ауданын таңдаңыз' },
  address_label: { ru: 'Название (Дом, Работа…)', ky: 'Аталышы (Үй, Жумуш…)', uz: 'Nomi (Uy, Ish…)', kk: 'Атауы (Үй, Жұмыс…)' },
  address_line: { ru: 'Улица, дом, квартира', ky: 'Көчө, үй, батир', uz: "Ko'cha, uy, xonadon", kk: 'Көше, үй, пәтер' },
  address_added: { ru: 'Адрес сохранён', ky: 'Дарек сакталды', uz: 'Manzil saqlandi', kk: 'Мекенжай сақталды' },
  payment: { ru: 'Способ оплаты', ky: 'Төлөө ыкмасы', uz: "To'lov usuli", kk: 'Төлеу тәсілі' },
  pm_qr: { ru: 'QR-код', ky: 'QR-код', uz: 'QR-kod', kk: 'QR-код' },
  pm_qr_sub: { ru: 'MBank или любой банк', ky: 'MBank же каалаган банк', uz: 'MBank yoki istalgan bank', kk: 'MBank немесе кез келген банк' },
  pm_card: { ru: 'Карта', ky: 'Карта', uz: 'Karta', kk: 'Карта' },
  pm_card_sub: { ru: 'Visa, Mastercard, Элкарт', ky: 'Visa, Mastercard, Элкарт', uz: 'Visa, Mastercard, Elkart', kk: 'Visa, Mastercard, Элкарт' },
  pm_cash: { ru: 'Наличные', ky: 'Накталай', uz: 'Naqd', kk: 'Қолма-қол' },
  pm_cash_sub: { ru: 'При получении заказа', ky: 'Буйрутманы алганда', uz: 'Buyurtmani olganda', kk: 'Тапсырысты алғанда' },
  pm_cash_off: { ru: 'Сейчас недоступно для этих магазинов', ky: 'Азыр бул дүкөндөр үчүн жеткиликсиз', uz: "Hozir bu do'konlar uchun mavjud emas", kk: 'Қазір бұл дүкендер үшін қолжетімсіз' },
  pm_invoice: { ru: 'По счёту', ky: 'Эсеп боюнча', uz: "Hisob bo'yicha", kk: 'Шот бойынша' },
  pm_invoice_sub: { ru: 'Безнал для организаций', ky: 'Уюмдар үчүн накталай эмес', uz: 'Tashkilotlar uchun naqdsiz', kk: 'Ұйымдарға қолма-қолсыз' },
  pm_coins_only: { ru: 'Монетами', ky: 'Тыйындар менен', uz: 'Tangalar bilan', kk: 'Тиындармен' },
  comment: { ru: 'Комментарий', ky: 'Комментарий', uz: 'Izoh', kk: 'Пікір' },
  comment_placeholder: { ru: 'Подъезд, этаж, как найти…', ky: 'Подъезд, кабат, кантип табуу…', uz: 'Kirish, qavat, qanday topish…', kk: 'Кіреберіс, қабат, қалай табу…' },
  place_order: { ru: 'Заказать за {p}', ky: '{p} — буйрутма берүү', uz: '{p} — buyurtma berish', kk: '{p} — тапсырыс беру' },
  your_order: { ru: 'Ваш заказ', ky: 'Сиздин буйрутма', uz: 'Sizning buyurtmangiz', kk: 'Сіздің тапсырысыңыз' },

  // payment
  pay_title: { ru: 'Оплата', ky: 'Төлөм', uz: "To'lov", kk: 'Төлем' },
  scan_qr: { ru: 'Отсканируйте QR в приложении банка', ky: 'Банк тиркемесинде QR скандаңыз', uz: 'Bank ilovasida QR ni skanerlang', kk: 'Банк қосымшасында QR сканерлеңіз' },
  or_open_bank: { ru: 'или откройте приложение банка', ky: 'же банк тиркемесин ачыңыз', uz: 'yoki bank ilovasini oching', kk: 'немесе банк қосымшасын ашыңыз' },
  demo_notice: { ru: 'Демо-режим: реальные деньги не списываются', ky: 'Демо-режим: чыныгы акча алынбайт', uz: 'Demo rejim: haqiqiy pul yechilmaydi', kk: 'Демо режим: нақты ақша алынбайды' },
  i_paid_demo: { ru: 'Я оплатил (демо)', ky: 'Мен төлөдүм (демо)', uz: "Men to'ladim (demo)", kk: 'Мен төледім (демо)' },
  waiting_payment: { ru: 'Ждём оплату…', ky: 'Төлөмдү күтүп жатабыз…', uz: "To'lov kutilmoqda…", kk: 'Төлемді күтудеміз…' },
  order_number: { ru: 'Заказ {n}', ky: 'Буйрутма {n}', uz: 'Buyurtma {n}', kk: 'Тапсырыс {n}' },
  open_invoice: { ru: 'Открыть счёт', ky: 'Эсепти ачуу', uz: 'Hisobni ochish', kk: 'Шотты ашу' },
  invoice_hint: { ru: 'Оплатите счёт с расчётного счёта организации — заказ начнут собирать после поступления оплаты', ky: 'Эсепти уюмдун эсебинен төлөңүз — төлөм келгенден кийин буйрутма чогултулат', uz: "Hisobni tashkilot hisobidan to'lang — to'lov kelgach buyurtma yig'iladi", kk: 'Шотты ұйымның есепшотынан төлеңіз — төлем түскен соң тапсырыс жиналады' },
  card_hint: { ru: 'Оплата картой проходит на защищённой странице банка', ky: 'Карта менен төлөм банктын корголгон барагында өтөт', uz: "Karta to'lovi bankning himoyalangan sahifasida o'tadi", kk: 'Картамен төлем банктің қорғалған бетінде өтеді' },
  to_order: { ru: 'К заказу', ky: 'Буйрутмага', uz: 'Buyurtmaga', kk: 'Тапсырысқа' },

  // success
  success_title: { ru: 'Заказ оформлен!', ky: 'Буйрутма кабыл алынды!', uz: 'Buyurtma qabul qilindi!', kk: 'Тапсырыс қабылданды!' },
  success_paid: { ru: 'Оплата прошла. Магазины уже собирают ваш заказ', ky: 'Төлөм өттү. Дүкөндөр буйрутмаңызды чогултуп жатышат', uz: "To'lov o'tdi. Do'konlar buyurtmangizni yig'moqda", kk: 'Төлем өтті. Дүкендер тапсырысыңызды жинап жатыр' },
  success_cash: { ru: 'Оплата при получении. Магазины уже собирают ваш заказ', ky: 'Алганда төлөйсүз. Дүкөндөр буйрутмаңызды чогултуп жатышат', uz: "Qabul qilganda to'laysiz. Do'konlar buyurtmangizni yig'moqda", kk: 'Алғанда төлейсіз. Дүкендер тапсырысыңызды жинап жатыр' },
  success_invoice: { ru: 'Счёт выставлен. Соберём заказ после оплаты', ky: 'Эсеп берилди. Төлөмдөн кийин чогултабыз', uz: "Hisob berildi. To'lovdan keyin yig'amiz", kk: 'Шот берілді. Төлемнен кейін жинаймыз' },
  success_coins: { ru: 'После получения начислим +{n} {n|монету|монеты|монет}', ky: 'Алгандан кийин +{n} тыйын чегеребиз', uz: 'Qabul qilgach +{n} tanga beramiz', kk: 'Алған соң +{n} тиын береміз' },
  track_order: { ru: 'Следить за заказом', ky: 'Буйрутманы көзөмөлдөө', uz: 'Buyurtmani kuzatish', kk: 'Тапсырысты бақылау' },
  continue_shopping: { ru: 'Продолжить покупки', ky: 'Сатып алууну улантуу', uz: 'Xaridni davom ettirish', kk: 'Сатып алуды жалғастыру' },

  // orders
  orders_title: { ru: 'Мои заказы', ky: 'Менин буйрутмаларым', uz: 'Mening buyurtmalarim', kk: 'Менің тапсырыстарым' },
  no_orders: { ru: 'Заказов пока нет', ky: 'Азырынча буйрутма жок', uz: "Hozircha buyurtma yo'q", kk: 'Әзірге тапсырыс жоқ' },
  no_orders_sub: { ru: 'Первая доставка курьером — бесплатно', ky: 'Курьердин биринчи жеткирүүсү — акысыз', uz: 'Kuryerning birinchi yetkazishi — bepul', kk: 'Курьердің алғашқы жеткізуі — тегін' },
  orders_login: { ru: 'Войдите, чтобы видеть свои заказы', ky: 'Буйрутмаларды көрүү үчүн кириңиз', uz: "Buyurtmalarni ko'rish uchun kiring", kk: 'Тапсырыстарды көру үшін кіріңіз' },
  os_placed: { ru: 'Оформлен', ky: 'Берилди', uz: 'Rasmiylashtirildi', kk: 'Рәсімделді' },
  os_in_progress: { ru: 'В работе', ky: 'Иштелүүдө', uz: 'Jarayonda', kk: 'Орындалуда' },
  os_completed: { ru: 'Доставлен', ky: 'Жеткирилди', uz: 'Yetkazildi', kk: 'Жеткізілді' },
  os_cancelled: { ru: 'Отменён', ky: 'Жокко чыгарылды', uz: 'Bekor qilindi', kk: 'Бас тартылды' },
  ss_new: { ru: 'Новый', ky: 'Жаңы', uz: 'Yangi', kk: 'Жаңа' },
  ss_confirmed: { ru: 'Подтверждён', ky: 'Ырасталды', uz: 'Tasdiqlandi', kk: 'Расталды' },
  ss_assembling: { ru: 'Собирается', ky: 'Чогултулууда', uz: "Yig'ilmoqda", kk: 'Жиналуда' },
  ss_ready: { ru: 'Готов', ky: 'Даяр', uz: 'Tayyor', kk: 'Дайын' },
  ss_in_delivery: { ru: 'В пути', ky: 'Жолдо', uz: "Yo'lda", kk: 'Жолда' },
  ss_delivered: { ru: 'Доставлен', ky: 'Жеткирилди', uz: 'Yetkazildi', kk: 'Жеткізілді' },
  ss_cancelled: { ru: 'Отменён', ky: 'Жокко чыгарылды', uz: 'Bekor qilindi', kk: 'Бас тартылды' },
  ss_rejected: { ru: 'Отклонён магазином', ky: 'Дүкөн четке какты', uz: "Do'kon rad etdi", kk: 'Дүкен қабылдамады' },
  ps_pending: { ru: 'Ожидает оплаты', ky: 'Төлөм күтүлүүдө', uz: "To'lov kutilmoqda", kk: 'Төлем күтілуде' },
  ps_paid: { ru: 'Оплачен', ky: 'Төлөндү', uz: "To'landi", kk: 'Төленді' },
  ps_cash_on_delivery: { ru: 'Оплата при получении', ky: 'Алганда төлөө', uz: "Qabul qilganda to'lov", kk: 'Алғанда төлеу' },
  ps_awaiting_invoice: { ru: 'Ждём оплату по счёту', ky: 'Эсеп боюнча төлөм күтүлүүдө', uz: "Hisob bo'yicha to'lov kutilmoqda", kk: 'Шот бойынша төлем күтілуде' },
  ps_refunded: { ru: 'Деньги возвращены', ky: 'Акча кайтарылды', uz: 'Pul qaytarildi', kk: 'Ақша қайтарылды' },
  ps_failed: { ru: 'Оплата не прошла', ky: 'Төлөм өткөн жок', uz: "To'lov o'tmadi", kk: 'Төлем өтпеді' },
  pay_now: { ru: 'Оплатить', ky: 'Төлөө', uz: "To'lash", kk: 'Төлеу' },
  goods_n: { ru: '{n} {n|товар|товара|товаров}', ky: '{n} товар', uz: '{n} ta mahsulot', kk: '{n} тауар' },
  cancel_order: { ru: 'Отменить заказ', ky: 'Буйрутманы жокко чыгаруу', uz: 'Buyurtmani bekor qilish', kk: 'Тапсырыстан бас тарту' },
  cancel_confirm: { ru: 'Нажмите ещё раз, чтобы отменить', ky: 'Жокко чыгаруу үчүн дагы басыңыз', uz: 'Bekor qilish uchun yana bosing', kk: 'Бас тарту үшін тағы басыңыз' },
  order_cancelled: { ru: 'Заказ отменён', ky: 'Буйрутма жокко чыгарылды', uz: 'Buyurtma bekor qilindi', kk: 'Тапсырыстан бас тартылды' },
  repeat_order: { ru: 'Повторить заказ', ky: 'Буйрутманы кайталоо', uz: 'Buyurtmani takrorlash', kk: 'Тапсырысты қайталау' },
  repeated: { ru: 'Товары добавлены в корзину', ky: 'Товарлар себетке кошулду', uz: "Mahsulotlar savatga qo'shildi", kk: 'Тауарлар себетке қосылды' },
  write_support: { ru: 'Написать в поддержку', ky: 'Колдоого жазуу', uz: "Qo'llab-quvvatlashga yozish", kk: 'Қолдауға жазу' },
  return_item: { ru: 'Возврат', ky: 'Кайтаруу', uz: 'Qaytarish', kk: 'Қайтару' },
  return_text: { ru: 'Хочу оформить возврат по заказу {n}', ky: '{n} буйрутмасы боюнча кайтаруу жасагым келет', uz: "{n} buyurtma bo'yicha qaytarish qilmoqchiman", kk: '{n} тапсырысы бойынша қайтару жасағым келеді' },
  support_order_text: { ru: 'Вопрос по заказу {n}', ky: '{n} буйрутмасы боюнча суроо', uz: "{n} buyurtma bo'yicha savol", kk: '{n} тапсырысы бойынша сұрақ' },
  delivery_address: { ru: 'Адрес', ky: 'Дарек', uz: 'Manzil', kk: 'Мекенжай' },
  payment_method: { ru: 'Оплата', ky: 'Төлөм', uz: "To'lov", kk: 'Төлем' },

  // profile
  guest: { ru: 'Гость', ky: 'Конок', uz: 'Mehmon', kk: 'Қонақ' },
  guest_sub: { ru: 'Войдите, чтобы копить монеты и следить за заказами', ky: 'Тыйын топтоо жана буйрутмаларды көзөмөлдөө үчүн кириңиз', uz: "Tanga yig'ish va buyurtmalarni kuzatish uchun kiring", kk: 'Тиын жинау және тапсырыстарды бақылау үшін кіріңіз' },
  your_name: { ru: 'Ваше имя', ky: 'Атыңыз', uz: 'Ismingiz', kk: 'Атыңыз' },
  name_saved: { ru: 'Имя сохранено', ky: 'Аты сакталды', uz: 'Ism saqlandi', kk: 'Аты сақталды' },
  language: { ru: 'Язык', ky: 'Тил', uz: 'Til', kk: 'Тіл' },
  coins: { ru: 'Монеты', ky: 'Тыйындар', uz: 'Tangalar', kk: 'Тиындар' },
  coins_balance: { ru: '{n} {n|монета|монеты|монет}', ky: '{n} тыйын', uz: '{n} tanga', kk: '{n} тиын' },
  coins_eq: { ru: '= {x} скидки на следующий заказ', ky: '= кийинки буйрутмага {x} арзандатуу', uz: '= keyingi buyurtmaga {x} chegirma', kk: '= келесі тапсырысқа {x} жеңілдік' },
  how_it_works: { ru: 'Как это работает', ky: 'Бул кантип иштейт', uz: 'Bu qanday ishlaydi', kk: 'Бұл қалай жұмыс істейді' },
  coins_rule1: { ru: '1 монета за каждые 100 сом покупок', ky: 'Ар бир 100 сом үчүн 1 тыйын', uz: "Har 100 so'm xarid uchun 1 tanga", kk: 'Әр 100 сом үшін 1 тиын' },
  coins_rule2: { ru: '1 монета = 1 сом', ky: '1 тыйын = 1 сом', uz: "1 tanga = 1 so'm", kk: '1 тиын = 1 сом' },
  coins_rule3: { ru: 'Оплачивайте монетами до 30% заказа', ky: 'Буйрутманын 30% чейин тыйын менен төлөңүз', uz: "Buyurtmaning 30% gacha tangalar bilan to'lang", kk: 'Тапсырыстың 30% дейін тиынмен төлеңіз' },
  coins_rule4: { ru: '+{n} {n|монета|монеты|монет} за каждого приглашённого друга', ky: 'Ар бир чакырылган дос үчүн +{n} тыйын', uz: "Har bir taklif qilingan do'st uchun +{n} tanga", kk: 'Әр шақырылған дос үшін +{n} тиын' },
  coins_history: { ru: 'История монет', ky: 'Тыйындардын тарыхы', uz: 'Tangalar tarixi', kk: 'Тиындар тарихы' },
  cr_welcome: { ru: 'Приветственный бонус', ky: 'Куттуктоо бонусу', uz: 'Xush kelibsiz bonusi', kk: 'Қош келу бонусы' },
  cr_cashback: { ru: 'Кешбэк за заказ', ky: 'Буйрутма үчүн кешбэк', uz: 'Buyurtma uchun keshbek', kk: 'Тапсырыс үшін кешбэк' },
  cr_order_payment: { ru: 'Оплата заказа', ky: 'Буйрутманы төлөө', uz: "Buyurtma to'lovi", kk: 'Тапсырыс төлемі' },
  cr_referral: { ru: 'Друг сделал заказ', ky: 'Досуңуз буйрутма берди', uz: "Do'stingiz buyurtma berdi", kk: 'Досыңыз тапсырыс берді' },
  cr_referral_welcome: { ru: 'Бонус по приглашению', ky: 'Чакыруу бонусу', uz: 'Taklif bonusi', kk: 'Шақыру бонусы' },
  cr_refund: { ru: 'Возврат монет', ky: 'Тыйындарды кайтаруу', uz: 'Tangalar qaytarildi', kk: 'Тиындарды қайтару' },
  cr_admin_bonus: { ru: 'Подарок от Taptym', ky: 'Taptym белеги', uz: "Taptym sovg'asi", kk: 'Taptym сыйлығы' },
  invite_friends: { ru: 'Пригласите друзей', ky: 'Досторуңузду чакырыңыз', uz: "Do'stlaringizni taklif qiling", kk: 'Достарыңызды шақырыңыз' },
  invite_sub: { ru: 'Друг получит {f} {f|монету|монеты|монет}, а вы — {b} после его первого заказа', ky: 'Досуңуз {f} тыйын алат, сиз — анын биринчи буйрутмасынан кийин {b}', uz: "Do'stingiz {f} tanga oladi, siz esa uning birinchi buyurtmasidan keyin {b}", kk: 'Досыңыз {f} тиын алады, сіз — оның алғашқы тапсырысынан кейін {b}' },
  your_code: { ru: 'Ваш код', ky: 'Сиздин код', uz: 'Sizning kodingiz', kk: 'Сіздің кодыңыз' },
  invited_n: { ru: 'Приглашено: {n}', ky: 'Чакырылды: {n}', uz: 'Taklif qilindi: {n}', kk: 'Шақырылды: {n}' },
  share_text: { ru: 'Покупаю канцтовары в Taptym — он сравнивает цены всех магазинов Оша. Мой код {code} даёт {n} монет!', ky: 'Канцтоварларды Taptym аркылуу алам — Оштун бардык дүкөндөрүнүн бааларын салыштырат. Менин кодум {code} {n} тыйын берет!', uz: "Kanselyariya mollarini Taptym orqali olaman — O'shdagi barcha do'konlar narxini solishtiradi. Mening kodim {code} {n} tanga beradi!", kk: 'Кеңсе тауарларын Taptym арқылы аламын — Оштың барлық дүкендерінің бағасын салыстырады. Менің кодым {code} {n} тиын береді!' },
  favorites: { ru: 'Избранное', ky: 'Тандалмалар', uz: 'Sevimlilar', kk: 'Таңдаулылар' },
  no_favorites: { ru: 'Нажимайте ♥ на товарах, чтобы сохранить их здесь', ky: 'Бул жерде сактоо үчүн товарлардагы ♥ басыңыз', uz: "Bu yerda saqlash uchun mahsulotlardagi ♥ ni bosing", kk: 'Мұнда сақтау үшін тауарлардағы ♥ басыңыз' },
  addresses: { ru: 'Мои адреса', ky: 'Менин даректерим', uz: 'Mening manzillarim', kk: 'Менің мекенжайларым' },
  no_addresses: { ru: 'Адресов пока нет', ky: 'Азырынча дарек жок', uz: "Hozircha manzil yo'q", kk: 'Әзірге мекенжай жоқ' },
  company: { ru: 'Я покупаю для организации', ky: 'Мен уюм үчүн сатып алам', uz: 'Men tashkilot uchun xarid qilaman', kk: 'Мен ұйым үшін сатып аламын' },
  company_sub: { ru: 'Оплата по счёту и закрывающие документы', ky: 'Эсеп боюнча төлөө жана жабуучу документтер', uz: "Hisob bo'yicha to'lov va yopuvchi hujjatlar", kk: 'Шот бойынша төлеу және жабу құжаттары' },
  company_name: { ru: 'Название организации', ky: 'Уюмдун аталышы', uz: 'Tashkilot nomi', kk: 'Ұйым атауы' },
  company_inn: { ru: 'ИНН', ky: 'ИСН', uz: 'STIR', kk: 'ЖСН' },
  saved: { ru: 'Сохранено', ky: 'Сакталды', uz: 'Saqlandi', kk: 'Сақталды' },
  support: { ru: 'Поддержка', ky: 'Колдоо', uz: "Qo'llab-quvvatlash", kk: 'Қолдау' },
  support_sub: { ru: 'Отвечаем за 10 минут, 08:00–22:00', ky: '10 мүнөттө жооп беребиз, 08:00–22:00', uz: 'Javob 10 daqiqada, 08:00–22:00', kk: '10 минутта жауап береміз, 08:00–22:00' },
  logout: { ru: 'Выйти', ky: 'Чыгуу', uz: 'Chiqish', kk: 'Шығу' },
  no_notifications: { ru: 'Уведомлений пока нет', ky: 'Азырынча билдирме жок', uz: "Hozircha bildirishnoma yo'q", kk: 'Әзірге хабарлама жоқ' },
  app_version: { ru: 'Taptym · демо-версия', ky: 'Taptym · демо-версия', uz: 'Taptym · demo versiya', kk: 'Taptym · демо нұсқа' },

  // support
  new_question: { ru: 'Новый вопрос', ky: 'Жаңы суроо', uz: 'Yangi savol', kk: 'Жаңа сұрақ' },
  no_threads: { ru: 'Обращений пока нет', ky: 'Азырынча кайрылуу жок', uz: "Hozircha murojaat yo'q", kk: 'Әзірге өтініш жоқ' },
  message_placeholder: { ru: 'Сообщение…', ky: 'Билдирүү…', uz: 'Xabar…', kk: 'Хабарлама…' },
  describe_problem: { ru: 'Опишите вопрос — оператор ответит в этом чате', ky: 'Суроону жазыңыз — оператор ушул чатта жооп берет', uz: 'Savolni yozing — operator shu chatda javob beradi', kk: 'Сұрақты жазыңыз — оператор осы чатта жауап береді' },
  topic: { ru: 'Тема', ky: 'Тема', uz: 'Mavzu', kk: 'Тақырып' },
  topic_placeholder: { ru: 'Например: доставка, оплата', ky: 'Мисалы: жеткирүү, төлөм', uz: "Masalan: yetkazish, to'lov", kk: 'Мысалы: жеткізу, төлем' },
  closed: { ru: 'Закрыт', ky: 'Жабык', uz: 'Yopiq', kk: 'Жабық' },
  call_support: { ru: 'Позвонить', ky: 'Чалуу', uz: "Qo'ng'iroq", kk: 'Қоңырау шалу' },

  // login
  login_title: { ru: 'Вход в Taptym', ky: 'Taptym’ге кирүү', uz: 'Taptym’ga kirish', kk: 'Taptym-ға кіру' },
  login_sub: { ru: 'Отправим SMS с кодом. Пароль не нужен', ky: 'Код менен SMS жөнөтөбүз. Сырсөз керек эмес', uz: 'Kod bilan SMS yuboramiz. Parol kerak emas', kk: 'Кодпен SMS жібереміз. Құпиясөз керек емес' },
  phone: { ru: 'Номер телефона', ky: 'Телефон номери', uz: 'Telefon raqami', kk: 'Телефон нөмірі' },
  get_code: { ru: 'Получить код', ky: 'Код алуу', uz: 'Kod olish', kk: 'Код алу' },
  referral_code: { ru: 'Код друга', ky: 'Досуңуздун коду', uz: "Do'st kodi", kk: 'Дос коды' },
  have_referral: { ru: 'У меня есть код друга', ky: 'Менде досумдун коду бар', uz: "Menda do'st kodi bor", kk: 'Менде дос коды бар' },
  enter_code: { ru: 'Введите код из SMS', ky: 'SMSтеги кодду жазыңыз', uz: 'SMS dagi kodni kiriting', kk: 'SMS-тегі кодты енгізіңіз' },
  code_sent: { ru: 'Отправили на {phone}', ky: '{phone} номерине жөнөттүк', uz: '{phone} raqamiga yubordik', kk: '{phone} нөміріне жібердік' },
  demo_code: { ru: 'Демо-код: {code}', ky: 'Демо-код: {code}', uz: 'Demo-kod: {code}', kk: 'Демо-код: {code}' },
  change_phone: { ru: 'Изменить номер', ky: 'Номерди өзгөртүү', uz: "Raqamni o'zgartirish", kk: 'Нөмірді өзгерту' },
  confirm: { ru: 'Подтвердить', ky: 'Ырастоо', uz: 'Tasdiqlash', kk: 'Растау' },
  terms: { ru: 'Продолжая, вы соглашаетесь с условиями сервиса', ky: 'Улантуу менен кызматтын шарттарына макул болосуз', uz: 'Davom etib, xizmat shartlariga rozilik bildirasiz', kk: 'Жалғастыра отырып, қызмет шарттарымен келісесіз' },
  welcome_back: { ru: 'С возвращением, {name}!', ky: 'Кайра кош келиңиз, {name}!', uz: 'Qaytganingiz bilan, {name}!', kk: 'Қайта қош келдіңіз, {name}!' },
  welcome_new: { ru: 'Добро пожаловать в Taptym!', ky: 'Taptym’ге кош келиңиз!', uz: 'Taptym’ga xush kelibsiz!', kk: 'Taptym-ға қош келдіңіз!' },
  demo_fill: { ru: 'Демо: подставить номер', ky: 'Демо: номерди коюу', uz: "Demo: raqamni qo'yish", kk: 'Демо: нөмірді қою' },

  // school lists
  school_title: { ru: 'Списки в школу', ky: 'Мектепке тизмелер', uz: "Maktab ro'yxatlari", kk: 'Мектепке тізімдер' },
  school_sub: { ru: 'Найдём самую низкую цену в Оше для каждого пункта', ky: 'Ар бир буюм үчүн Оштогу эң арзан бааны табабыз', uz: "Har bir band uchun O'shdagi eng arzon narxni topamiz", kk: 'Әр тармақ үшін Оштағы ең арзан бағаны табамыз' },
  add_all_cheapest: { ru: 'Всё в корзину по лучшей цене', ky: 'Баарын эң жакшы баада себетке', uz: 'Hammasini eng yaxshi narxda savatga', kk: 'Бәрін ең жақсы бағамен себетке' },
  missing_items: { ru: 'Не нашли: {list}', ky: 'Табылган жок: {list}', uz: 'Topilmadi: {list}', kk: 'Табылмады: {list}' },

  // server address (native app) and offline state
  server: { ru: 'Сервер', ky: 'Сервер', uz: 'Server', kk: 'Сервер' },
  server_row: { ru: 'Сервер: {url}', ky: 'Сервер: {url}', uz: 'Server: {url}', kk: 'Сервер: {url}' },
  server_title: { ru: 'Адрес сервера', ky: 'Сервердин дареги', uz: 'Server manzili', kk: 'Сервер мекенжайы' },
  server_address: { ru: 'Адрес (IP и порт)', ky: 'Дарек (IP жана порт)', uz: 'Manzil (IP va port)', kk: 'Мекенжай (IP және порт)' },
  server_hint: {
    ru: 'Приложение работает через компьютер-сервер. Телефон и компьютер должны быть в одной Wi-Fi сети. Пример: 192.168.0.4:3000',
    ky: 'Тиркеме сервер-компьютер аркылуу иштейт. Телефон менен компьютер бир Wi-Fi тармагында болушу керек. Мисалы: 192.168.0.4:3000',
    uz: "Ilova server-kompyuter orqali ishlaydi. Telefon va kompyuter bitta Wi-Fi tarmog'ida bo'lishi kerak. Masalan: 192.168.0.4:3000",
    kk: 'Қосымша сервер-компьютер арқылы жұмыс істейді. Телефон мен компьютер бір Wi-Fi желісінде болуы керек. Мысалы: 192.168.0.4:3000',
  },
  server_check: { ru: 'Проверить', ky: 'Текшерүү', uz: 'Tekshirish', kk: 'Тексеру' },
  server_ok: { ru: 'Сервер доступен', ky: 'Сервер жеткиликтүү', uz: 'Server ishlayapti', kk: 'Сервер қолжетімді' },
  server_fail_network: {
    ru: 'Нет ответа. Проверьте адрес, что сервер запущен и телефон в той же Wi-Fi сети',
    ky: 'Жооп жок. Даректи, сервер күйүк экенин жана телефон ошол эле Wi-Fi тармагында экенин текшериңиз',
    uz: "Javob yo'q. Manzilni, server yoqilganini va telefon o'sha Wi-Fi tarmog'ida ekanini tekshiring",
    kk: 'Жауап жоқ. Мекенжайды, сервер қосулы екенін және телефон сол Wi-Fi желісінде екенін тексеріңіз',
  },
  server_fail_timeout: { ru: 'Сервер не ответил за {n} сек.', ky: 'Сервер {n} секундда жооп берген жок', uz: 'Server {n} soniyada javob bermadi', kk: 'Сервер {n} секундта жауап бермеді' },
  server_fail_status: { ru: 'Сервер ответил ошибкой {code}', ky: 'Сервер {code} катасы менен жооп берди', uz: 'Server {code} xatosi bilan javob berdi', kk: 'Сервер {code} қатесімен жауап берді' },
  server_fail_foreign: { ru: 'По этому адресу работает не сервер Taptym', ky: 'Бул даректе Taptym сервери эмес', uz: 'Bu manzilda Taptym serveri emas', kk: 'Бұл мекенжайда Taptym сервері емес' },
  server_bad_url: { ru: 'Неверный адрес. Пример: 192.168.0.4:3000', ky: 'Дарек туура эмес. Мисалы: 192.168.0.4:3000', uz: "Manzil noto'g'ri. Masalan: 192.168.0.4:3000", kk: 'Мекенжай қате. Мысалы: 192.168.0.4:3000' },
  server_saved: { ru: 'Адрес сервера сохранён', ky: 'Сервердин дареги сакталды', uz: 'Server manzili saqlandi', kk: 'Сервер мекенжайы сақталды' },
  server_reset: { ru: 'По умолчанию: {url}', ky: 'Демейки: {url}', uz: 'Standart: {url}', kk: 'Әдепкі: {url}' },
  server_not_set: { ru: 'не указан', ky: 'көрсөтүлгөн эмес', uz: "ko'rsatilmagan", kk: 'көрсетілмеген' },
  server_settings: { ru: 'Настройки сервера', ky: 'Сервердин жөндөөлөрү', uz: 'Server sozlamalari', kk: 'Сервер баптаулары' },
  offline_title: { ru: 'Нет связи с сервером', ky: 'Сервер менен байланыш жок', uz: "Server bilan aloqa yo'q", kk: 'Сервермен байланыс жоқ' },
  offline_sub: {
    ru: 'Проверьте, что компьютер-сервер включён и телефон подключён к той же Wi-Fi сети.',
    ky: 'Сервер-компьютер күйүк экенин жана телефон ошол эле Wi-Fi тармагына туташканын текшериңиз.',
    uz: "Server-kompyuter yoqilganini va telefon o'sha Wi-Fi tarmog'iga ulanganini tekshiring.",
    kk: 'Сервер-компьютер қосулы екенін және телефон сол Wi-Fi желісіне қосылғанын тексеріңіз.',
  },

  // errors
  err_network: {
    ru: 'Нет связи с сервером. Проверьте, что компьютер-сервер включён и телефон подключён к той же Wi-Fi сети.',
    ky: 'Сервер менен байланыш жок. Сервер-компьютер күйүк экенин жана телефон ошол эле Wi-Fi тармагына туташканын текшериңиз.',
    uz: "Server bilan aloqa yo'q. Server-kompyuter yoqilganini va telefon o'sha Wi-Fi tarmog'iga ulanganini tekshiring.",
    kk: 'Сервермен байланыс жоқ. Сервер-компьютер қосулы екенін және телефон сол Wi-Fi желісіне қосылғанын тексеріңіз.',
  },
  err_server: { ru: 'Ошибка сервера. Попробуйте ещё раз', ky: 'Сервер катасы. Кайра аракет кылыңыз', uz: "Server xatosi. Qayta urinib ko'ring", kk: 'Сервер қатесі. Қайта көріңіз' },
  err_bad_phone: { ru: 'Проверьте номер телефона', ky: 'Телефон номерин текшериңиз', uz: 'Telefon raqamini tekshiring', kk: 'Телефон нөмірін тексеріңіз' },
  err_bad_code: { ru: 'Неверный код. Попробуйте ещё раз', ky: 'Код туура эмес. Кайра аракет кылыңыз', uz: "Kod noto'g'ri. Qayta urinib ko'ring", kk: 'Код қате. Қайта көріңіз' },
  err_user_blocked: { ru: 'Аккаунт заблокирован. Напишите в поддержку', ky: 'Аккаунт бөгөттөлгөн. Колдоого жазыңыз', uz: "Akkaunt bloklangan. Qo'llab-quvvatlashga yozing", kk: 'Аккаунт бұғатталған. Қолдауға жазыңыз' },
  err_unauthorized: { ru: 'Войдите заново', ky: 'Кайра кириңиз', uz: 'Qaytadan kiring', kk: 'Қайта кіріңіз' },
  err_cart_empty: { ru: 'Корзина пуста', ky: 'Себет бош', uz: "Savat bo'sh", kk: 'Себет бос' },
  err_address_required: { ru: 'Выберите адрес доставки', ky: 'Жеткирүү дарегин тандаңыз', uz: 'Yetkazish manzilini tanlang', kk: 'Жеткізу мекенжайын таңдаңыз' },
  err_out_of_stock: { ru: 'Закончился товар: {x}. Обновите корзину', ky: 'Товар түгөндү: {x}. Себетти жаңыртыңыз', uz: 'Mahsulot tugadi: {x}. Savatni yangilang', kk: 'Тауар таусылды: {x}. Себетті жаңартыңыз' },
  err_cash_not_allowed: { ru: 'Наличные недоступны для этого заказа', ky: 'Бул буйрутма үчүн накталай жеткиликсиз', uz: 'Bu buyurtma uchun naqd mavjud emas', kk: 'Бұл тапсырыс үшін қолма-қол қолжетімсіз' },
  err_invoice_company_only: { ru: 'Оплата по счёту — только для организаций', ky: 'Эсеп боюнча төлөө — уюмдар үчүн гана', uz: "Hisob bo'yicha to'lov — faqat tashkilotlar uchun", kk: 'Шот бойынша төлеу — тек ұйымдарға' },
  err_cannot_cancel: { ru: 'Заказ уже собирают — отменить нельзя. Напишите в поддержку', ky: 'Буйрутма чогултулуп жатат — жокко чыгаруу мүмкүн эмес', uz: "Buyurtma yig'ilmoqda — bekor qilib bo'lmaydi", kk: 'Тапсырыс жиналуда — бас тарту мүмкін емес' },
  err_promo_not_found: { ru: 'Такого промокода нет', ky: 'Мындай промокод жок', uz: "Bunday promokod yo'q", kk: 'Мұндай промокод жоқ' },
  err_promo_expired: { ru: 'Срок промокода истёк', ky: 'Промокоддун мөөнөтү бүттү', uz: 'Promokod muddati tugagan', kk: 'Промокод мерзімі өтті' },
  err_promo_exhausted: { ru: 'Промокод закончился', ky: 'Промокод түгөндү', uz: 'Promokod tugadi', kk: 'Промокод таусылды' },
  err_promo_used: { ru: 'Вы уже использовали этот промокод', ky: 'Бул промокодду колдонгонсуз', uz: 'Bu promokoddan foydalangansiz', kk: 'Бұл промокодты қолдандыңыз' },
  err_promo_wrong_supplier: { ru: 'Промокод действует в другом магазине', ky: 'Промокод башка дүкөндө иштейт', uz: "Promokod boshqa do'konda amal qiladi", kk: 'Промокод басқа дүкенде жарамды' },
  err_promo_min_total: { ru: 'Сумма заказа мала для этого промокода', ky: 'Бул промокод үчүн сумма аз', uz: 'Bu promokod uchun summa kam', kk: 'Бұл промокод үшін сома аз' },
  err_file_too_large: { ru: 'Файл слишком большой', ky: 'Файл өтө чоң', uz: 'Fayl juda katta', kk: 'Файл тым үлкен' },
  err_file_type_not_allowed: { ru: 'Этот тип файла не подходит', ky: 'Бул файл түрү туура келбейт', uz: 'Bu fayl turi mos emas', kk: 'Бұл файл түрі сәйкес емес' },
  err_text_required: { ru: 'Напишите сообщение', ky: 'Билдирүү жазыңыз', uz: 'Xabar yozing', kk: 'Хабарлама жазыңыз' },
  err_bad_review: { ru: 'Поставьте оценку от 1 до 5', ky: '1ден 5ке чейин баа коюңуз', uz: "1 dan 5 gacha baho qo'ying", kk: '1-ден 5-ке дейін баға қойыңыз' },
  err_bad_address: { ru: 'Проверьте адрес', ky: 'Даректи текшериңиз', uz: 'Manzilni tekshiring', kk: 'Мекенжайды тексеріңіз' },
  err_not_found: { ru: 'Не найдено', ky: 'Табылган жок', uz: 'Topilmadi', kk: 'Табылмады' },
} satisfies Dict;

export type TKey = keyof typeof dict;
export type TFn = (key: TKey, vars?: Record<string, string | number>) => string;
const base = createTranslator(dict);

/** Adds Russian plural forms: `{n|товар|товара|товаров}` picks the form for `vars.n`. */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s = base(lang, key);
  if (vars) {
    s = s.replace(/\{(\w+)\|([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (_, name: string, one: string, few: string, many: string) =>
      pluralRu(Math.abs(Number(vars[name] ?? 0)), one, few, many),
    );
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

/** Translator bound to the current language; components re-render when it changes. */
export function useT(): TFn {
  const lang = useApp((s) => s.lang);
  return useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export function tNow(key: TKey, vars?: Record<string, string | number>) {
  return translate(useApp.getState().lang, key, vars);
}

export function useLang(): Lang {
  return useApp((s) => s.lang);
}

/** Maps API `{error: code}` values to a localized message. */
export function errorText(e: unknown): string {
  const code: string = (e as { code?: string })?.code ?? 'server';
  if (code.startsWith('out_of_stock:')) return tNow('err_out_of_stock', { x: code.slice('out_of_stock:'.length) });
  if (code.endsWith('_not_found') && !code.startsWith('promo')) return tNow('err_not_found');
  const key = `err_${code}` as TKey;
  return key in dict ? tNow(key) : tNow('err_server');
}

export function promoErrorKey(code: string): TKey {
  const key = `err_${code}` as TKey;
  return key in dict ? key : 'err_promo_not_found';
}
