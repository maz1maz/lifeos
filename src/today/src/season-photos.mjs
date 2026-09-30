// Unsplash photo IDs (free license) — 12 per season.
// Local copies live in /assets/img/seasons/<season>-NN.jpg (run: node scripts/get-season-photos.mjs).
export const SEASON_PHOTOS = {
  spring: ['1590252497923-3c2b38e85d37','1470240731273-7821a6eeb6bd','1556066138-cfac27159329','1559722345-0bef499140fb','1529288871968-9945adb0588f','1680324418462-b23941af9c86','1416230789844-1998de481fdc','1494280986787-c49b328829dd','1530257543896-1e0d096c7157','1572966101025-e199cab72196','1595198526495-e43a42f84558','1584098731526-e3924fad98db'],
  summer: ['1612441804231-77a36b284856','1664737267645-776346859df9','1541843713287-e0d5de49a384','1495710388177-22c73fa5f84e','1560354791-0a913268e31b','1593539651148-13fb61a49325','1697990160615-b533316a1d81','1635351261340-55f437000b21','1482689860904-c5747d0c8995','1789150072896-f0f40f202a25','1594080672883-e2c902712441','1690617930867-b30c2c10e55f'],
  autumn: ['1666033402224-32e982c253f7','1666033390776-2dc8c6f6a2ca','1496660887775-12d35540ea00','1664896192176-a2151370ce41','1669447856093-4a13fa8bbc69','1731617662729-cdde91663de9','1523712999610-f77fbcfc3843','1637652361190-fe846b632030','1697814174264-9229edc5184f','1698603038554-835c9c76d1ff','1670709914742-382af7f33896','1667521898828-78d57d218490'],
  winter: ['1491002052546-bf38f186af56','1453306458620-5bbef13a5bca','1517299321609-52687d1bc55a','1518984211165-a6c9abed630f','1496765111150-918497b59c9e','1612099452850-ed8efe7d58ff','1635420280816-c0dc0ee8a7a7','1722682446067-5da6ad1fd00e','1518983835933-984f33c641e0','1577457943926-11193adc0563','1549057255-854cb1b9e71c','1614093643263-7ebf3d099724']
};
export const seasonOfJalaliMonth = m => m <= 3 ? 'spring' : m <= 6 ? 'summer' : m <= 9 ? 'autumn' : 'winter';
export const unsplashUrl = (id, w = 1400) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${Math.round(w * 0.62)}&fit=crop&crop=entropy&q=68&fm=jpg`;
// Same photo all day, a different one each day.
export function photoOfDay(jm, dayIndex) {
  const season = seasonOfJalaliMonth(jm), list = SEASON_PHOTOS[season], i = ((dayIndex % list.length) + list.length) % list.length;
  return { season, i, local: `/assets/img/seasons/${season}-${String(i + 1).padStart(2, '0')}.jpg`, remote: unsplashUrl(list[i]) };
}
