"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { trackEcommerce, trackEvent } from "../lib/analytics";
import { formatMoney } from "../lib/format";

type Product = {
  id: number;
  title: string;
  category: string;
  description: string;
  priceCents: number;
  rating: number;
  inventory: number;
  imageUrl: string;
};

type User = { id: number; name: string; email: string };

type CartItem = {
  productId: number;
  title: string;
  category: string;
  priceCents: number;
  imageUrl: string;
  inventory: number;
  quantity: number;
};

type Order = {
  id: number;
  status: string;
  totalCents: number;
  createdAt: string;
  deliveryAddress: string;
  items: { title: string; quantity: number; priceCents: number }[];
};

type Message = { type: "ok" | "error"; text: string } | null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  async function refreshMe() {
    const data = await api<{ user: User | null; orders: Order[] }>("/api/me");
    setUser(data.user);
    setOrders(data.orders);
    if (data.user) {
      const cart = await api<{ items: CartItem[]; totalCents: number }>("/api/cart");
      setCartItems(cart.items);
      setCartTotal(cart.totalCents);
    } else {
      setCartItems([]);
      setCartTotal(0);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [productData, accountData] = await Promise.all([
          api<{ products: Product[] }>("/api/products"),
          api<{ user: User | null; orders: Order[] }>("/api/me"),
        ]);
        if (cancelled) {
          return;
        }

        setProducts(productData.products);
        setUser(accountData.user);
        setOrders(accountData.orders);

        if (accountData.user) {
          const cart = await api<{ items: CartItem[]; totalCents: number }>("/api/cart");
          if (!cancelled) {
            setCartItems(cart.items);
            setCartTotal(cart.totalCents);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: "error", text: error instanceof Error ? error.message : "Ошибка загрузки" });
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };

    try {
      const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const data = await api<{ user: User }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(data.user);
      setMessage({
        type: "ok",
        text: authMode === "register" ? "Аккаунт создан." : "Вы вошли.",
      });
      trackEvent(authMode === "register" ? "registration_success" : "login_success", {
        userId: data.user.id,
      });
      await refreshMe();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Ошибка входа" });
    } finally {
      setBusy(false);
    }
  }

  async function addToCart(product: Product) {
    if (!user) {
      setMessage({ type: "error", text: "Сначала зарегистрируйтесь или войдите." });
      return;
    }

    setBusy(true);
    try {
      const cart = await api<{ items: CartItem[]; totalCents: number }>("/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      setCartItems(cart.items);
      setCartTotal(cart.totalCents);
      setMessage({ type: "ok", text: `${product.title} добавлен в корзину.` });
      trackEcommerce("add", {
        products: [{ id: product.id, name: product.title, price: product.priceCents / 100, quantity: 1 }],
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Ошибка корзины" });
    } finally {
      setBusy(false);
    }
  }

  async function updateQuantity(productId: number, quantity: number) {
    const cart = await api<{ items: CartItem[]; totalCents: number }>("/api/cart", {
      method: "PATCH",
      body: JSON.stringify({ productId, quantity }),
    });
    setCartItems(cart.items);
    setCartTotal(cart.totalCents);
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: String(form.get("customerName") ?? ""),
      customerPhone: String(form.get("customerPhone") ?? ""),
      deliveryAddress: String(form.get("deliveryAddress") ?? ""),
    };

    try {
      const data = await api<{ order: Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCartItems([]);
      setCartTotal(0);
      await refreshMe();
      setMessage({ type: "ok", text: `Заказ #${data.order.id} создан.` });
      trackEcommerce("purchase", {
        actionField: { id: data.order.id, revenue: data.order.totalCents / 100 },
        products: data.order.items.map((item) => ({
          name: item.title,
          price: item.priceCents / 100,
          quantity: item.quantity,
        })),
      });
      event.currentTarget.reset();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Ошибка заказа" });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    setUser(null);
    setOrders([]);
    setCartItems([]);
    setCartTotal(0);
    trackEvent("logout");
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#191816]">
      <header className="sticky top-0 z-20 border-b border-[#d8d1c2] bg-[#f7f5ef]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a6f5e]">Market Lane</p>
            <h1 className="text-2xl font-semibold">Интернет-магазин</h1>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-[#d8d1c2] bg-white px-4 py-2 text-sm">
            <span aria-hidden="true">Cart</span>
            <span>{cartCount} шт.</span>
            <strong>{formatMoney(cartTotal)}</strong>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-lg border border-[#d8d1c2] bg-white">
              <div className="aspect-[4/3] bg-[#ece7dc]">
                <img className="h-full w-full object-cover" src={product.imageUrl} alt={product.title} />
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-[#7a6f5e]">{product.category}</p>
                    <h2 className="text-lg font-semibold leading-tight">{product.title}</h2>
                  </div>
                  <span className="rounded bg-[#e4f0e4] px-2 py-1 text-sm font-semibold text-[#315d3a]">
                    {product.rating}
                  </span>
                </div>
                <p className="min-h-16 text-sm leading-6 text-[#615a50]">{product.description}</p>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-xl">{formatMoney(product.priceCents)}</strong>
                  <button
                    className="rounded-md bg-[#1f5e57] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#174943]"
                    disabled={busy || product.inventory === 0}
                    onClick={() => addToCart(product)}
                  >
                    + В корзину
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          {message ? (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                message.type === "ok"
                  ? "border-[#9fc2a3] bg-[#edf7ee] text-[#315d3a]"
                  : "border-[#d7a3a0] bg-[#fff0ee] text-[#8b3029]"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <section className="rounded-lg border border-[#d8d1c2] bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{user ? "Профиль" : "Аккаунт"}</h2>
              {user ? (
                <button className="text-sm font-semibold text-[#1f5e57]" onClick={logout}>
                  Выйти
                </button>
              ) : (
                <div className="flex rounded-md border border-[#d8d1c2] p-1 text-sm">
                  <button
                    className={`rounded px-3 py-1 ${authMode === "register" ? "bg-[#1f5e57] text-white" : ""}`}
                    onClick={() => setAuthMode("register")}
                  >
                    Регистрация
                  </button>
                  <button
                    className={`rounded px-3 py-1 ${authMode === "login" ? "bg-[#1f5e57] text-white" : ""}`}
                    onClick={() => setAuthMode("login")}
                  >
                    Вход
                  </button>
                </div>
              )}
            </div>

            {user ? (
              <div className="text-sm leading-6">
                <p className="font-semibold">{user.name}</p>
                <p className="text-[#615a50]">{user.email}</p>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={submitAuth}>
                {authMode === "register" ? (
                  <input className="w-full rounded-md border border-[#d8d1c2] px-3 py-2" name="name" placeholder="Имя" />
                ) : null}
                <input className="w-full rounded-md border border-[#d8d1c2] px-3 py-2" name="email" placeholder="Email" />
                <input
                  className="w-full rounded-md border border-[#d8d1c2] px-3 py-2"
                  name="password"
                  placeholder="Пароль"
                  type="password"
                />
                <button className="w-full rounded-md bg-[#1f5e57] px-4 py-2 font-semibold text-white" disabled={busy}>
                  {authMode === "register" ? "Создать аккаунт" : "Войти"}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-lg border border-[#d8d1c2] bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold">Корзина</h2>
            {cartItems.length === 0 ? (
              <p className="text-sm text-[#615a50]">Корзина пока пуста.</p>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.productId} className="grid grid-cols-[56px_1fr_auto] gap-3">
                    <img className="h-14 w-14 rounded-md object-cover" src={item.imageUrl} alt={item.title} />
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-sm text-[#615a50]">{formatMoney(item.priceCents)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-8 w-8 rounded border border-[#d8d1c2]"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <button
                        className="h-8 w-8 rounded border border-[#d8d1c2]"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between border-t border-[#d8d1c2] pt-3 font-semibold">
                  <span>Итого</span>
                  <span>{formatMoney(cartTotal)}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[#d8d1c2] bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold">Оформление</h2>
            <form className="space-y-3" onSubmit={checkout}>
              <input className="w-full rounded-md border border-[#d8d1c2] px-3 py-2" name="customerName" placeholder="Получатель" />
              <input className="w-full rounded-md border border-[#d8d1c2] px-3 py-2" name="customerPhone" placeholder="Телефон" />
              <textarea
                className="min-h-20 w-full rounded-md border border-[#d8d1c2] px-3 py-2"
                name="deliveryAddress"
                placeholder="Адрес доставки"
              />
              <button
                className="w-full rounded-md bg-[#191816] px-4 py-2 font-semibold text-white"
                disabled={!user || cartItems.length === 0 || busy}
              >
                Заказать
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-[#d8d1c2] bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold">История заказов</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[#615a50]">После первой покупки заказы появятся здесь.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-md border border-[#e5dfd2] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong>#{order.id}</strong>
                      <span>{formatMoney(order.totalCents)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#615a50]">{new Date(order.createdAt).toLocaleString("ru-RU")}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.title}`} className="flex justify-between gap-3">
                          <span>
                            {item.title} x {item.quantity}
                          </span>
                          <span>{formatMoney(item.priceCents * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
