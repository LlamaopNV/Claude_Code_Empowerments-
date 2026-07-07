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
  ordered_at  TEXT NOT NULL
);
CREATE TABLE order_items (
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL
);

INSERT INTO customers VALUES
  (1, 'Ada', 'Berlin'),
  (2, 'Ben', 'Lisbon'),
  (3, 'Cleo', 'Berlin'),
  (4, 'Dev', 'Oslo');

INSERT INTO products VALUES
  (1, 'Keyboard', 'peripherals', 5000),
  (2, 'Mouse', 'peripherals', 2500),
  (3, 'Monitor', 'displays', 20000),
  (4, 'Light', 'displays', 4000),
  (5, 'Webcam', 'peripherals', 8000),
  (6, 'Cable', 'peripherals', 500);

INSERT INTO orders VALUES
  (1, 1, '2025-11-03'),
  (2, 2, '2025-11-17'),
  (3, 1, '2025-12-05'),
  (4, 3, '2025-12-21'),
  (5, 4, '2026-01-09'),
  (6, 1, '2026-01-30');

INSERT INTO order_items VALUES
  (1, 1, 1),
  (1, 2, 2),
  (2, 3, 1),
  (3, 5, 1),
  (3, 4, 1),
  (4, 2, 4),
  (5, 1, 2),
  (5, 3, 1),
  (6, 4, 2);
