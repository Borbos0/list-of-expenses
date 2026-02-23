import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export function seedUser(db: Database.Database): void {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(config.AUTH_USERNAME) as { id: number } | undefined;
  if (existing) return;

  const hash = bcrypt.hashSync(config.AUTH_PASSWORD, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
    config.AUTH_USERNAME,
    hash,
  );
  const userId = Number(result.lastInsertRowid);
  console.log(`User '${config.AUTH_USERNAME}' seeded`);

  seedDefaultRules(db, userId);
}

function seedDefaultRules(db: Database.Database, userId: number): void {
  const getCategoryId = (name: string): number | null => {
    const row = db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number } | undefined;
    return row?.id ?? null;
  };

  const cat = (name: string) => getCategoryId(name);

  const insert = db.prepare(
    'INSERT INTO rules (user_id, match_type, pattern, action_type, action_category_id, action_set_type, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  const rules: Array<[string, string, string, number | null, string | null, number]> = [
    // Маркетплейсы
    ['contains', 'Озон Банк', 'categorize', cat('Маркетплейсы'), null, 10],
    ['contains', 'Ozon', 'categorize', cat('Маркетплейсы'), null, 10],
    ['contains', 'Wildberries', 'categorize', cat('Маркетплейсы'), null, 10],
    ['contains', 'Aliexpress', 'categorize', cat('Маркетплейсы'), null, 10],
    ['contains', 'Яндекс Маркет', 'categorize', cat('Маркетплейсы'), null, 10],
    ['contains', 'Мегамаркет', 'categorize', cat('Маркетплейсы'), null, 10],
    // Доставка
    ['contains', 'Яндекс Еда', 'categorize', cat('Доставка'), null, 10],
    ['contains', 'Delivery Club', 'categorize', cat('Доставка'), null, 10],
    // Такси
    ['contains', 'Яндекс Go', 'categorize', cat('Такси'), null, 10],
    ['contains', 'Uber', 'categorize', cat('Такси'), null, 10],
    ['contains', 'Ситимобил', 'categorize', cat('Такси'), null, 10],
    // Продукты
    ['contains', 'Пятёрочка', 'categorize', cat('Продукты'), null, 10],
    ['contains', 'Пятерочка', 'categorize', cat('Продукты'), null, 10],
    ['contains', 'Перекрёсток', 'categorize', cat('Продукты'), null, 10],
    ['contains', 'Лента', 'categorize', cat('Продукты'), null, 10],
    ['contains', 'Магнит', 'categorize', cat('Продукты'), null, 10],
    ['contains', "О'КЕЙ", 'categorize', cat('Продукты'), null, 10],
    // Фастфуд
    ['contains', 'Вкусно — и точка', 'categorize', cat('Фастфуд'), null, 10],
    ['contains', 'Вкусно и точка', 'categorize', cat('Фастфуд'), null, 10],
    ['contains', 'KFC', 'categorize', cat('Фастфуд'), null, 10],
    ['contains', "Rostic's", 'categorize', cat('Фастфуд'), null, 10],
    ['contains', 'Rostics', 'categorize', cat('Фастфуд'), null, 10],
    ['contains', 'Burger King', 'categorize', cat('Фастфуд'), null, 10],
    ['contains', 'McDonald', 'categorize', cat('Фастфуд'), null, 10],
    ['contains', 'Subway', 'categorize', cat('Фастфуд'), null, 10],
    // Рестораны
    ['contains', 'Kleek', 'categorize', cat('Рестораны'), null, 10],
    // Транспорт
    ['contains', 'AVTOBUSNYJ PARK', 'categorize', cat('Транспорт'), null, 10],
    ['contains', 'METRO TPP', 'categorize', cat('Транспорт'), null, 10],
    ['contains', 'bilet.nspk.ru', 'categorize', cat('Транспорт'), null, 10],
    ['contains', 'Тройка', 'categorize', cat('Транспорт'), null, 10],
    ['contains', 'Подорожник', 'categorize', cat('Транспорт'), null, 10],
    // Здоровье
    ['contains', 'Аптека', 'categorize', cat('Здоровье'), null, 10],
    ['contains', 'АПТЕКА', 'categorize', cat('Здоровье'), null, 10],
    ['contains', 'Здравсити', 'categorize', cat('Здоровье'), null, 10],
    ['contains', 'Стоматолог', 'categorize', cat('Здоровье'), null, 10],
    ['contains', 'Поликлиника', 'categorize', cat('Здоровье'), null, 10],
    ['contains', 'ИНВИТРО', 'categorize', cat('Здоровье'), null, 10],
    ['contains', 'Гемотест', 'categorize', cat('Здоровье'), null, 10],
    // Спорт
    ['contains', 'Fitness House', 'categorize', cat('Спорт'), null, 10],
    // Подписки
    ['contains', 'Яндекс Плюс', 'categorize', cat('Подписки'), null, 10],
    // Связь
    ['contains', 'МТС', 'categorize', cat('Связь'), null, 10],
    // Интернет и технологии
    ['contains', 'Рег.ру', 'categorize', cat('Интернет и технологии'), null, 10],
    ['contains', 'Serv.Host Technology', 'categorize', cat('Интернет и технологии'), null, 10],
    ['contains', 'Gameparade', 'categorize', cat('Интернет и технологии'), null, 10],
    // Переводы (имена: "Александр К.", "Михаил Б." и т.п.)
    ['regex', '^[А-ЯЁ][а-яё]+ [А-ЯЁ]\\.$', 'categorize', cat('Переводы'), null, 5],
    // Инвесткопилка → игнор (перевод между своими счетами)
    ['contains', 'инвесткопилку', 'set_type', null, 'ignore', 20],
  ];

  const seedTransaction = db.transaction(() => {
    for (const [matchType, pattern, actionType, categoryId, setType, priority] of rules) {
      insert.run(userId, matchType, pattern, actionType, categoryId, setType, priority);
    }
  });

  seedTransaction();
  console.log(`Default rules seeded: ${rules.length}`);
}
