export type UpgradeTrack =
  | "counterSpeed"
  | "shelfCapacity"
  | "saleValue"
  | "customerPatience"
  | "tipChance"
  | "restockCapacity"
  | "decorAppeal";

export type ExpansionStage =
  | "tinyShop"
  | "largerRetailFloor"
  | "secondCounter"
  | "premiumSection"
  | "storageRoom"
  | "cannabisCafe"
  | "lounge"
  | "deliveryDesk";

export interface UpgradeDefinition {
  baseCost: number;
  maxLevel: number;
}

export interface ProgressionSnapshot {
  cash: number;
  upgrades: Record<UpgradeTrack, number>;
  unlockedExpansions: ExpansionStage[];
}

const UPGRADE_DEFINITIONS: Record<UpgradeTrack, UpgradeDefinition> = {
  counterSpeed: { baseCost: 50, maxLevel: 5 },
  shelfCapacity: { baseCost: 60, maxLevel: 5 },
  saleValue: { baseCost: 75, maxLevel: 5 },
  customerPatience: { baseCost: 55, maxLevel: 5 },
  tipChance: { baseCost: 70, maxLevel: 5 },
  restockCapacity: { baseCost: 65, maxLevel: 5 },
  decorAppeal: { baseCost: 45, maxLevel: 5 },
};

const EXPANSION_ORDER: ExpansionStage[] = [
  "tinyShop",
  "largerRetailFloor",
  "secondCounter",
  "premiumSection",
  "storageRoom",
  "cannabisCafe",
  "lounge",
  "deliveryDesk",
];

const EXPANSION_COSTS: Record<ExpansionStage, number> = {
  tinyShop: 0,
  largerRetailFloor: 500,
  secondCounter: 900,
  premiumSection: 1400,
  storageRoom: 2200,
  cannabisCafe: 3500,
  lounge: 5000,
  deliveryDesk: 7500,
};

export class StoreProgression {
  private cash: number;
  private upgrades: Record<UpgradeTrack, number> = {
    counterSpeed: 0,
    shelfCapacity: 0,
    saleValue: 0,
    customerPatience: 0,
    tipChance: 0,
    restockCapacity: 0,
    decorAppeal: 0,
  };
  private unlockedExpansions = new Set<ExpansionStage>(["tinyShop"]);

  constructor(startingCash = 0) {
    if (!Number.isSafeInteger(startingCash) || startingCash < 0) {
      throw new Error("invalid starting cash");
    }
    this.cash = startingCash;
  }

  getUpgradeCost(track: UpgradeTrack): number {
    const definition = UPGRADE_DEFINITIONS[track];
    if (!definition) throw new Error("unknown upgrade track");
    const currentLevel = this.upgrades[track];
    if (currentLevel >= definition.maxLevel) throw new Error("upgrade maxed");
    return definition.baseCost * (currentLevel + 1);
  }

  purchaseUpgrade(track: UpgradeTrack): number {
    const cost = this.getUpgradeCost(track);
    if (cost > this.cash) throw new Error("insufficient cash");
    this.cash -= cost;
    this.upgrades[track] += 1;
    return cost;
  }

  getExpansionCost(stage: ExpansionStage): number {
    if (!(stage in EXPANSION_COSTS)) throw new Error("unknown expansion stage");
    return EXPANSION_COSTS[stage];
  }

  unlockExpansion(stage: ExpansionStage): number {
    if (stage === "tinyShop") throw new Error("starting expansion already unlocked");
    if (this.unlockedExpansions.has(stage)) throw new Error("expansion already unlocked");

    const index = EXPANSION_ORDER.indexOf(stage);
    if (index < 0) throw new Error("unknown expansion stage");
    const prerequisite = EXPANSION_ORDER[index - 1];
    if (!this.unlockedExpansions.has(prerequisite)) throw new Error("missing expansion prerequisite");

    const cost = this.getExpansionCost(stage);
    if (cost > this.cash) throw new Error("insufficient cash");

    this.cash -= cost;
    this.unlockedExpansions.add(stage);
    return cost;
  }

  creditCash(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("invalid cash credit");
    this.cash += amount;
  }

  snapshot(): ProgressionSnapshot {
    return {
      cash: this.cash,
      upgrades: { ...this.upgrades },
      unlockedExpansions: EXPANSION_ORDER.filter(stage => this.unlockedExpansions.has(stage)),
    };
  }
}
