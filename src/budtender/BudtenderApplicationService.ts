import { BudtenderCustomerSystem } from "./BudtenderCustomers.ts";
import type {
  CustomerArchetype,
  CustomerSnapshot,
  DemandProfile,
} from "./BudtenderCustomers.ts";
import {
  calculateOfflineProgression,
} from "./OfflineProgression.ts";
import type {
  OfflineProgressionInput,
  OfflineProgressionResult,
} from "./OfflineProgression.ts";
import { BudtenderStore } from "./BudtenderStore.ts";
import type {
  StarterProduct,
  StoreSnapshot,
} from "./BudtenderStore.ts";
import type {
  ExpansionStage,
  ProgressionSnapshot,
  UpgradeTrack,
} from "./StoreProgression.ts";

export interface CustomerArrivalCommand {
  id: string;
  product: StarterProduct;
  archetype?: CustomerArchetype;
  patienceOverride?: number;
}

export interface BudtenderApplicationSnapshot {
  store: StoreSnapshot;
  customers: CustomerSnapshot;
  progression: ProgressionSnapshot;
}

export class BudtenderApplicationService {
  #store = new BudtenderStore();
  #customers = new BudtenderCustomerSystem(this.#store);

  arriveCustomer(command: CustomerArrivalCommand): void {
    this.#customers.addCustomer(
      command.id,
      command.product,
      command.archetype,
      command.patienceOverride,
    );
  }

  tickCustomers(): void {
    this.#customers.tick();
  }

  serveCustomer(customerId: string): number {
    return this.#customers.serveCustomer(customerId);
  }

  restock(product: StarterProduct, units: number): void {
    // Application callers cannot inject a price. The store resolves the canonical
    // BUD-3 wholesale price internally.
    this.#store.restock(product, units);
  }

  purchaseUpgrade(track: UpgradeTrack): void {
    this.#store.purchaseProgressionUpgrade(track);
  }

  unlockExpansion(stage: ExpansionStage): number {
    return this.#store.unlockExpansion(stage);
  }

  setDemandProfile(profile: DemandProfile): void {
    this.#customers.setDemandProfile(profile);
  }

  evaluateOfflineProgression(input: OfflineProgressionInput): OfflineProgressionResult {
    // Non-mutating by design. Until persistence owns trusted cursor/source state,
    // the application layer must not apply caller-supplied offline rewards.
    return calculateOfflineProgression(input);
  }

  snapshot(): BudtenderApplicationSnapshot {
    return {
      store: this.#store.snapshot(),
      customers: this.#customers.snapshot(),
      progression: this.#store.progressionSnapshot(),
    };
  }
}
