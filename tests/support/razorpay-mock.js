// Loopback-only provider fixture for Playwright. It has no access to live credentials.
const orders = new Map();
const payments = new Map();
const id = () => crypto.randomUUID().replaceAll("-", "");

Bun.serve({
  hostname: "127.0.0.1",
  port: 3112,
  async fetch(request) {
    const url = new URL(request.url);
    const [, resource, key, sub] = url.pathname.split("/");
    if (resource === "health") return Response.json({ status: "ok" });
    if (resource === "orders" && request.method === "POST" && !key) {
      const input = await request.json();
      if (
        [...orders.values()].some((record) => record.receipt === input.receipt)
      )
        return new Response(null, { status: 409 });
      const order = { ...input, id: `order_${id()}`, status: "created" };
      orders.set(order.id, order);
      return Response.json(order);
    }
    if (resource === "orders" && !key)
      return Response.json({
        items: [...orders.values()].filter(
          (order) => order.receipt === url.searchParams.get("receipt"),
        ),
      });
    if (resource === "orders" && sub === "payments")
      return Response.json({
        items: [...payments.values()].filter(
          (payment) => payment.order_id === key,
        ),
      });
    if (resource === "test-capture" && request.method === "POST") {
      const order = orders.get(key);
      if (!order) return new Response(null, { status: 404 });
      const payment = {
        id: `pay_${id()}`,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: "captured",
        captured: true,
        method: "upi",
      };
      payments.set(payment.id, payment);
      order.status = "paid";
      return Response.json(payment);
    }
    const payment = payments.get(key);
    if (resource === "payments" && payment && !sub)
      return Response.json(payment);
    return new Response(null, { status: 404 });
  },
});
