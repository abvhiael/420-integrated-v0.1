import { ProductInventory, STARTER_CATALOG } from "./ProductInventory.ts";
import { StoreProgression } from "./StoreProgression.ts";

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

const PRODUCT_IDS: Record<StarterProduct, string> = {
  flower: "flower-house",
  preroll: "preroll-house",
  edible: "edible-house",
};

export class BudtenderStore {
  private readonly inventory = new ProductInventory(STARTER_CATALOG);
  private readonly progression = new StoreProgression();
  private readonly orders = new Map<string, CustomerOrder>();

  createOrder(id: string, product: StarterProduct): CustomerOrder {
    if (!id || this.orders.has(id)) throw new Error("invalid or duplicate order id");
    const productId = PRODUCT_IDS[product];
    if (!productId) throw new Error("unknown product");

    const item = this.inventory.get(productId);
    if (!item.unlocked) throw new Error("product locked");

    const order: CustomerOrder = { id, product, served: false };
    this.orders.set(id, order);
    return { ...order };
  }

  serveOrder(id: string): number {
    const order = this.orders.get(id);
    if (!order) throw new Error("unknown order");
    if (order.served) throw new Error("order already served");

    const baseSale = this.inventory.consume(PRODUCT_IDS[order.product]);
    const saleValueLevel = this.progression.snapshot().upgrades.saleValue;
    const sale = Math.round(baseSale * (1 + saleValueLevel * 0.1));

    this.progression.creditCash(sale);
    order.served = true;
    return sale;
  }

  restock(product: StarterProduct, units: number, unitCost?: number): void {
    if (!Number.isInteger(units) || units <= 0) throw new Error("invalid restock units");

    const productId = PRODUCT_IDS[product];
    if (!productId) throw new Error("unknown product");
    const item = this.inventory.get(productId);
    const canonicalUnitCost = item.wholesaleUnitCost;

    if (unitCost !== undefined && (!Number.isFinite(unitCost) || unitCost < 0)) {
      throw new Error("invalid unit cost");
    }
    if (unitCost !== undefined && unitCost !== canonicalUnitCost) {
      throw new Error("unit cost does not match canonical catalog");
    }

    const cost = units * canonicalUnitCost;
    if (cost > this.progression.snapshot().cash) throw new Error("insufficient cash");

    this.inventory.restock(productId, units);
    this.progression.debitCash(cost);
  }

  grantStartingCash(amount: number): void {
    this.progression.creditCash(amount);
  }

  purchaseUpgrade(kind: keyof UpgradeState): void {
    const track =
      kind === "serviceSpeed" ? "counterSpeed" :
      kind === "shelfCapacity" ? "shelfCapacity" :
      "saleValue";

    this.progression.purchaseUpgrade(track);

    if (kind === "shelfCapacity") {
      for (const productId of Object.values(PRODUCT_IDS)) {
        this.inventory.increaseCapacity(productId, 2);
      }
    }
  }

  snapshot(): StoreSnapshot {
    const progression = this.progression.snapshot();
    return {
      cash: progression.cash,
      products: {
        flower: this.productSnapshot("flower"),
        preroll: this.productSnapshot("preroll"),
        edible: this.productSnapshot("edible"),
      },
      upgrades: {
        shelfCapacity: progression.upgrades.shelfCapacity,
        serviceSpeed: progression.upgrades.counterSpeed,
        saleValue: progression.upgrades.saleValue,
      },
    };
  }

  private productSnapshot(product: StarterProduct): ProductState {
    const item = this.inventory.get(PRODUCT_IDS[product]);
    return {
      stock: item.stock,
      capacity: item.capacity,
      basePrice: item.baseSalePrice,
    };
  }
}
