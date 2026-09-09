import { BudtenderStore, StarterProduct } from "./BudtenderStore";

export type CustomerArchetype = "regular" | "impatient" | "enthusiast" | "bargainHunter";
export type CustomerStatus = "queued" | "served" | "abandoned";
export type DemandProfile = "normal" | "fourTwentyRush";

export interface CustomerState {
  id: string;
  orderId: string;
  product: StarterProduct;
  archetype: CustomerArchetype;
  patienceRemaining: number;
  status: CustomerStatus;
  arrivalSequence: number;
}

export interface CustomerSnapshot {
  customers: CustomerState[];
  queue: string[];
  demandProfile: DemandProfile;
}

const DEFAULT_PATIENCE: Record<CustomerArchetype, number> = {
  regular: 5,
  impatient: 3,
  enthusiast: 7,
  bargainHunter: 6,
};

export class BudtenderCustomerSystem {
  private customers = new Map<string, CustomerState>();
  private arrivalSequence = 0;
  private demandProfile: DemandProfile = "normal";

  constructor(private readonly store: BudtenderStore) {}

  setDemandProfile(profile: DemandProfile): void {
    this.demandProfile = profile;
  }

  addCustomer(
    id: string,
    product: StarterProduct,
    archetype: CustomerArchetype = "regular",
    patienceOverride?: number,
  ): CustomerState {
    if (!id || this.customers.has(id)) throw new Error("invalid or duplicate customer id");

    const patience = patienceOverride ?? DEFAULT_PATIENCE[archetype];
    if (!Number.isInteger(patience) || patience <= 0) throw new Error("invalid patience");

    const orderId = `customer:${id}`;
    this.store.createOrder(orderId, product);

    const customer: CustomerState = {
      id,
      orderId,
      product,
      archetype,
      patienceRemaining: patience,
      status: "queued",
      arrivalSequence: this.arrivalSequence++,
    };
    this.customers.set(id, customer);
    return { ...customer };
  }

  tick(): void {
    for (const customer of this.orderedQueue()) {
      if (customer.status !== "queued") continue;
      customer.patienceRemaining = Math.max(0, customer.patienceRemaining - 1);
      if (customer.patienceRemaining === 0) customer.status = "abandoned";
    }
  }

  serveCustomer(id: string): number {
    const customer = this.customers.get(id);
    if (!customer) throw new Error("unknown customer");
    if (customer.status === "served") throw new Error("customer already served");
    if (customer.status === "abandoned") throw new Error("customer abandoned");

    const sale = this.store.serveOrder(customer.orderId);
    customer.status = "served";
    return sale;
  }

  currentQueue(): string[] {
    return this.orderedQueue()
      .filter((customer) => customer.status === "queued")
      .map((customer) => customer.id);
  }

  snapshot(): CustomerSnapshot {
    return {
      customers: Array.from(this.customers.values())
        .sort((a, b) => a.arrivalSequence - b.arrivalSequence)
        .map((customer) => ({ ...customer })),
      queue: this.currentQueue(),
      demandProfile: this.demandProfile,
    };
  }

  private orderedQueue(): CustomerState[] {
    return Array.from(this.customers.values()).sort(
      (a, b) => a.arrivalSequence - b.arrivalSequence,
    );
  }
}
