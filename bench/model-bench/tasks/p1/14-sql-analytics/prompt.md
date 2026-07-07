Write SQLite SQL (saved as `solution.sql`). The database has this schema:

    CREATE TABLE customers (
      id    INTEGER PRIMARY KEY,
      name  TEXT NOT NULL,
      city  TEXT NOT NULL
    );
    CREATE TABLE products (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      price_cents INTEGER NOT NULL
    );
    CREATE TABLE orders (
      id          INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      ordered_at  TEXT NOT NULL  -- ISO date, e.g. '2025-11-03'
    );
    CREATE TABLE order_items (
      order_id   INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity   INTEGER NOT NULL
    );

Revenue for an order item = quantity * the product's price_cents.

Your file must contain EXACTLY three SELECT statements (a statement may use
WITH), separated by semicolons, in this order — no other statements, no
comments, and no semicolons inside string literals. Each query's output
columns must use exactly the names given (alias with AS):

1. Top 3 customers by total spend.
   Columns: name, total_cents.
   Order: total_cents DESC, then name ASC. LIMIT 3.

2. Revenue per calendar month (only months that have at least one order),
   with a running total.
   Columns: month (format YYYY-MM, e.g. via strftime('%Y-%m', ordered_at)),
   revenue_cents, cumulative_cents (running sum of revenue_cents in month
   order).
   Order: month ASC.

3. Every product's share of its category's revenue, INCLUDING products that
   were never ordered (their revenue is 0). You may assume every category
   has at least one ordered product.
   Columns: category, product (the product name),
   share_pct = ROUND(100.0 * product_revenue / category_revenue, 1).
   Order: category ASC, share_pct DESC, product ASC.
