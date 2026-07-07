SELECT c.name AS name,
       SUM(oi.quantity * p.price_cents) AS total_cents
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY c.id
ORDER BY total_cents DESC, name ASC
LIMIT 3;

WITH monthly AS (
  SELECT strftime('%Y-%m', o.ordered_at) AS month,
         SUM(oi.quantity * p.price_cents) AS revenue_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  GROUP BY month
)
SELECT month,
       revenue_cents,
       SUM(revenue_cents) OVER (ORDER BY month) AS cumulative_cents
FROM monthly
ORDER BY month ASC;

WITH rev AS (
  SELECT p.category AS category,
         p.name AS product,
         COALESCE(SUM(oi.quantity * p.price_cents), 0) AS revenue
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  GROUP BY p.id
)
SELECT category,
       product,
       ROUND(100.0 * revenue / SUM(revenue) OVER (PARTITION BY category), 1) AS share_pct
FROM rev
ORDER BY category ASC, share_pct DESC, product ASC;
