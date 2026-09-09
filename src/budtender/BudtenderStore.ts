export type StarterProduct = "flower" | "preroll" | "edible";

export interface ProductState {
  stock: number;
  capacity: number;
  basePrice: number;
}

export interface CustomerOrder {
  id: string;
  product: StarterProduct;
  served: boolean;
}

export interface UpgradeState {
  shelfCapacity: number;
  serviceSpeed: number;
  saleValue: number;
}

export interface StoreSnapshot {
  cash: number;
  products: Record<StarterProduct, ProductState>;
  upgrades: UpgradeState;
}

const STARTER_PRODUCTS: Record<StarterProduct, ProductState> = {
  flower: { stock: 4, capacity: 6, basePrice: 20 },
  preroll: { stock: 4, capacity: 6, basePrice: 10 },
  edible: { stock: 4, capacity: 6, basePrice: 8 },
};

const MAX_UPGRADE_LEVEL = 5;

export class BudtenderStore {
  private cash = 0;
  private products: Record<StarterProduct, ProductState> = structuredClone(STARTER_PRODUCTS);
  private upgrades: UpgradeState = { shelfCapacity: 0, serviceSpeed: 0, saleValue: 0 };
  private orders = new Map<string, CustomerOrder>();

  createOrder(id: string, product: StarterProduct): CustomerOrder {
    if (!id || this.orders.has(id)) throw new Error("invalid or duplicate order id");
    if (!(product in this.products)) throw new Error("unknown product");

    const order: CustomerOrder = { id, product, served: false };
    this.orders.set(id, order);
    return { ...order };
  }

  serveOrder(id: string): number {
    const order = this.orders.get(id);
    if (!order) throw new Error("unknown order");
    if (order.served) throw new Error("order already served");

    const product = this.products[order.product];
    if (product.stock <= 0) throw new Error("product unavailable");

    product.stock -= 1;
    order.served = true;

    const multiplier = 1 + this.upgrades.saleValue * 0.1;
    const sale = Math.round(product.basePrice * multiplier);
    this.cash += sale;
    return sale;
  }

  restock(product: StarterProduct, units: number, unitCost: number): void {
    if (!Number.isInteger(units) || units <= 0) throw new Error("invalid restock units");
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("invalid unit cost");

    const item = this.products[product];
    if (!item) throw new Error("unknown product");
    if (item.stock + units > item.capacity) throw new Error("restock exceeds capacity");

    const cost = units * unitCost;
    if (cost > this.cash) throw new Error("insufficient cash");

    this.cash -= cost;
    item.stock += units;
  }

  grantStartingCash(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) throw new Error("invalid starting cash");
    this.cash += amount;
  }

  purchaseUpgrade(kind: keyof UpgradeState): void {
    const current = this.upgrades[kind];
    if (current >= MAX_UPGRADE_LEVEL) throw new Error("upgrade maxed");

    const cost = 50 * (current + 1);
    if (cost > this.cash) throw new Error("insufficient cash");

    this.cash -= cost;
    this.upgrades[kind] += 1;

    if (kind === "shelfCapacity") {
      for (const item of Object.values(this.products)) item.capacity += 2;
    }
  }

  snapshot(): StoreSnapshot {
    return {
      cash: this.cash,
      products: structuredClone(this.products),
      upgrades: { ...this.upgrades },
    };
  }
}
