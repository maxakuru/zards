const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

export class Cart {
  static STORAGE_KEY = "cart";
  static STORAGE_VERSION = 1;
  static SHIPPING_THRESHOLD = 150;

  /** @type {Record<string, CartItem>} */
  _items = {};

  constructor() {
    this._restore();
  }

  _restore() {
    const cart = localStorage.getItem(Cart.STORAGE_KEY);
    if (cart) {
      const parsed = JSON.parse(cart);
      if (parsed.version !== Cart.STORAGE_VERSION) {
        localStorage.removeItem(Cart.STORAGE_KEY);
        return;
      }
      this._items = parsed.items.reduce((acc, item) => {
        acc[item.sku] = item;
        return acc;
      }, {});
      document.dispatchEvent(
        new CustomEvent("cart:change", {
          detail: {
            cart: this,
            action: "restore",
          },
        })
      );
    }
  }

  _persist = debounce(() => {
    document.cookie = /cart_items_count=[\d]+/.test(document.cookie) 
        ? document.cookie.replace(/cart_items_count=[\d]+/, `cart_items_count=${this.itemCount}`) 
        : `${document.cookie}; cart_items_count=${this.itemCount}`;
    localStorage.setItem(Cart.STORAGE_KEY, JSON.stringify(this));
  }, 300);

  get items() {
    return Object.values(this._items);
  }

  get itemCount() {
    return Object.values(this._items).reduce(
      (acc, item) => acc + item.quantity,
      0
    );
  }

  get subtotal() {
    return Object.values(this._items).reduce(
      (acc, item) =>
        acc +
        item.quantity *
          (typeof item.price === "string"
            ? parseFloat(item.price)
            : item.price / 100),
      0
    );
  }

  get shipping() {
    return this.subtotal < Cart.SHIPPING_THRESHOLD ? 10 : 0;
  }

  clear() {
    this._items = {};
    this._persist();
    document.dispatchEvent(
      new CustomEvent("cart:change", {
        detail: {
          cart: this,
          action: "clear",
        },
      })
    );
  }

  /**
   * @param {CartItem} item
   */
  addItem(item) {
    const existing = this._items[item.sku];
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this._items[item.sku] = item;
    }
    document.dispatchEvent(
      new CustomEvent("cart:change", {
        detail: {
          cart: this,
          item: item,
          action: "add",
        },
      })
    );
    this._persist();
  }

  /**
   * @param {string} sku
   * @param {number} quantity
   */
  updateItem(sku, quantity) {
    if (!this._items[sku]) {
      throw new Error(`Item with sku ${sku} not found`);
    }
    this._items[sku].quantity = quantity;
    document.dispatchEvent(
      new CustomEvent("cart:change", {
        detail: {
          cart: this,
          item: this._items[sku],
          action: "update",
        },
      })
    );
    this._persist();
  }

  /**
   * @param {string} sku
   */
  removeItem(sku) {
    delete this._items[sku];
    document.dispatchEvent(
      new CustomEvent("cart:change", {
        detail: {
          cart: this,
          item: this._items[sku],
          action: "remove",
        },
      })
    );
    this._persist();
  }

  toJSON() {
    return {
      version: Cart.STORAGE_VERSION,
      items: Object.values(this._items),
    };
  }
}

window.cart = new Cart();
export default window.cart;
