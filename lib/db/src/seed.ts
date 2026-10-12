import { categoriesTable, db, pool } from "./index";

const starterCategories = [
  { name: "Food & Bakery", slug: "food-bakery" },
  { name: "Grocery & Essentials", slug: "grocery-essentials" },
  { name: "Fashion & Accessories", slug: "fashion-accessories" },
  { name: "Home & Living", slug: "home-living" },
  { name: "Beauty & Wellness", slug: "beauty-wellness" },
  { name: "Electronics & Repair", slug: "electronics-repair" },
  { name: "Books & Stationery", slug: "books-stationery" },
  { name: "Gifts & Crafts", slug: "gifts-crafts" },
];

try {
  await db.insert(categoriesTable).values(starterCategories).onConflictDoNothing();
  console.log(
    "Seeded starter categories. Add supported PIN codes in the admin panel; no synthetic shops, customers, or payments were created.",
  );
} finally {
  await pool.end();
}
