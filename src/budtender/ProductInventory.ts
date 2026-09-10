export type ProductCategory = "flower" | "preroll" | "edible";
export type QualityTier = "budget" | "standard" | "premium" | "craft" | "exotic";

export interface ProductDefinition {
  id: string;
  name: string;
  category: ProductCategory;
  quality: QualityTier;
  baseSalePrice: number;
  wholesaleUnitCost: number;
  baseDemand: number;
  capacity: number;
  unlocked?: boolean;
  startingStock?: number;
}

export interface ProductInventoryState extends ProductDefinition {
  unlocked: boolean;
  stock: number;
}

const assertInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
};

const validateDefinition = (definition: ProductDefinition): void => {
  if (!definition.id.trim()) throw new Error("product id required");
  if (!definition.name.trim()) throw new Error("product name required");

  assertInteger(definition.baseSalePrice, "base sale price");
  assertInteger(definition.wholesaleUnitCost, "wholesale unit cost");
  assertInteger(definition.baseDemand, "base demand");
  assertInteger(definition.capacity, "capacity");

  if (definition.baseSalePrice < 0 || definition.wholesaleUnitCost < 0) {
    throw new Error("product values cannot be negative");
  }
  if (definition.wholesaleUnitCost > definition.baseSalePrice) {
    throw new Error("wholesale cost exceeds base sale price");
  }
  if (definition.baseDemand < 0 || definition.baseDemand > 100) {
    throw new Error("base demand out of bounds");
  }
  if (definition.capacity <= 0) throw new Error("capacity must be positive");

  const startingStock = definition.startingStock ?? 0;
  assertInteger(startingStock, "starting stock");
  if (startingStock < 0 || startingStock > definition.capacity) {
    throw new Error("starting stock out of bounds");
  }
  if (startingStock > 0 && definition.unlocked === false) {
    throw new Error("locked product cannot start stocked");
  }
};

export class ProductInventory {
  private readonly products = new Map<string, ProductInventoryState>();

  constructor(definitions: ProductDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: ProductDefinition): void {
    validateDefinition(definition);
    if (this.products.has(definition.id)) throw new Error("duplicate product id");

    this.products.set(definition.id, {
      ...definition,
      unlocked: definition.unlocked ?? false,
      stock: definition.startingStock ?? 0,
    });
  }

  unlock(id: string): void {
    const product = this.requireProduct(id);
    product.unlocked = true;
  }

  restock(id: string, units: number): number {
    const product = this.requireProduct(id);
    if (!product.unlocked) throw new Error("product locked");
    assertInteger(units, "restock units");
    if (units <= 0) throw new Error("restock units must be positive");
    if (product.stock + units > product.capacity) throw new Error("restock exceeds capacity");

    product.stock += units;
    return units * product.wholesaleUnitCost;
  }

  consume(id: string, units = 1): number {
    const product = this.requireProduct(id);
    if (!product.unlocked) throw new Error("product locked");
    assertInteger(units, "consume units");
    if (units <= 0) throw new Error("consume units must be positive");
    if (units > product.stock) throw new Error("insufficient stock");

    product.stock -= units;
    return units * product.baseSalePrice;
  }

  get(id: string): ProductInventoryState {
    return structuredClone(this.requireProduct(id));
  }

  list(): ProductInventoryState[] {
    return [...this.products.values()].map((product) => structuredClone(product));
  }

  private requireProduct(id: string): ProductInventoryState {
    const product = this.products.get(id);
    if (!product) throw new Error("unknown product");
    return product;
  }
}

export const STARTER_CATALOG: ProductDefinition[] = [
  {
    id: "flower-house",
    name: "House Flower",
    category: "flower",
    quality: "standard",
    baseSalePrice: 20,
    wholesaleUnitCost: 10,
    baseDemand: 70,
    capacity: 8,
    unlocked: true,
    startingStock: 4,
  },
  {
    id: "preroll-house",
    name: "House Pre-Roll",
    category: "preroll",
    quality: "standard",
    baseSalePrice: 10,
    wholesaleUnitCost: 4,
    baseDemand: 80,
    capacity: 10,
    unlocked: true,
    startingStock: 4,
  },
  {
    id: "edible-house",
    name: "House Edible",
    category: "edible",
    quality: "standard",
    baseSalePrice: 8,
    wholesaleUnitCost: 3,
    baseDemand: 60,
    capacity: 10,
    unlocked: true,
    startingStock: 4,
  },
];
