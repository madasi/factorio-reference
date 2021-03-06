import { basicTable, staticTable, doubleRowHeaderTable, header, setRenderTarget } from './setup';
import { Belts, BeltLanes, Fuels, Boxes, Assemblers } from './factorio';
import {
    Displayable,
    fixed, item, itemCount, large, g, p, nOf, text, ratio,
    itemGroup, integer, long_time, medium_time, short_time,
    time, ceil, floor, toElement, percent, wholePercent, multiplied,
    energy
} from './displayable';

import { recipes } from './recipes';
import { items } from './items';
import * as data from './data';

const itemList: Array<typeof data.items.coal> = [];
for (const key of Object.keys(data.items)) {
    itemList.push((data.items as any)[key]);
}

/******* Belts ***********/
header("Factorio 101");
namespace SimpleTables {
    /** Belt Throughput **/
    doubleRowHeaderTable({
        title: "Belt Throughput",
        description: "How many items can each belt transport?",
        origin1: text("Interval"),
        origin2: text("Belt"),
        rows1: [text("per second"), text("per minute")],
        rows2: Belts,
        cols: ["One Lane", "Both Lanes"],
        cell(r1, r2, c, ri1, ri2, ci) {
            if (ri1 === 0) {
                return fixed(r2.throughput / (2 - ci));
            } else {
                return integer(r2.throughput / (2 - ci) * (ri1 === 0 ? 1 : 60));
            }
        }
    });

    /** Steam Power **/
    // TODO: Calculate this from game data
    staticTable({
        title: "Steam Power",
        rows: [
            [item("offshore-pump"), item("boiler"), item("steam-engine"), item("electric-mining-drill"), text("Power")],
            [integer(1), integer(20), integer(40), integer(18), fixed(40 * 0.900, "MW")]
        ]
    });
}

header("Energy Storage");
namespace EnergyStorageTables {
    const fuels = (itemList as any[]).filter(i => i.fuel_value > 2000000 && i.fuel_category==="chemical" && !i["place_result"]).sort((a, b) => a.fuel_value - b.fuel_value);
    const fuelList: {
        count: number;
        fuel: typeof items.coal
    }[] = [];
    for(const f of fuels) {
        fuelList.push({ count: 1, fuel: f});
        if (f.stack_size > 1) {
            fuelList.push({ count: f.stack_size, fuel: f});
        }
    }
    basicTable({
        title: "Energy Values",
        cols: ["energy", "boiler", "burner-inserter", "locomotive", "car", "tank"],
        colHeader: item,
        origin: "Fuel",
        rows: fuelList,
        rowHeader: r => {
            return itemCount(r.fuel.name, r.count);
        },
        cell: (row, col) => {
            const qty = row.count;
            const joules = row.fuel.fuel_value * qty;
            switch (col) {
                case "energy":
                    return energy(joules);
                case "boiler":
                    return time(joules / 3600000);
                case "locomotive":
                    return time(joules / 600000);
                case "car":
                    return time(joules / 250000);
                case "tank":
                    return time(joules / 800000);
                case "burner-inserter":
                    return time(joules / 188000);
            }
            return "meh";
        }
    });

    // joules per unit water per degree celcius
    const waterThermalCapacity = 200;
    // temperature of output water from a steam process
    const exitTemperature = 15;

    const tankCapacity = data.entities["storage-tank"].fluid_capacity;

    basicTable({
        title: "Steam Storage",
        rows: ["steam-engine", "steam-turbine"],
        origin: "",
        rowHeader: item,
        cols: ["Energy (MJ)", "Run Time"],
        cell: (row, col, ri, ci) => {
            const burner = (<any>data.entities)[row] as typeof data.entities["steam-engine"];
            const deltaTemp = burner.maximum_temperature - exitTemperature;
            if (ci === 0) {
                return g(integer(waterThermalCapacity * deltaTemp * tankCapacity / 1000000));
            } else {
                return time(tankCapacity / (burner.fluid_usage_per_tick * ci * 60));
            }
        }
    });
}

header("Nuclear Power");
namespace NuclearPowerTables {
    // TODO: Only run even numbers; go up to 16; include closed form
    // https://www.reddit.com/r/factorio/comments/67xgge/nuclear_ratios/
    staticTable({
        description: [
            "Once set up, a single enrichment centrifuge provides U235 for 30 reactors.",
            "https://www.reddit.com/r/factorio/comments/67xgge/nuclear_ratios/"
        ],
        title: "Nuclear Power Ratios",
        rows: [
            [item("nuclear-reactor"), item("offshore-pump"), item("heat-exchanger"), item("steam-turbine"), text("Power (MW)")],
            [1, 1, 4, 7, 40],
            [2, 2, 16, 28, 160],
            [4, 5, 48, 83, 580],
            [6, 7, 80, 138, 800],
            [8, 10, 112, 193, 1120]
        ]
    });

    // TODO: Figure out a closed-form mathy way to do this
    // e.g. http://www.wolframalpha.com/input/?i=odds+of+40+or+more+successes+in+8000+trials+p%3D0.007
    staticTable({
        title: "Kovarex Bootstrapping Probability",
        description: "Given an amount of uranium ore, what are my odds of getting the necessary 40 U235 to start enrichment?",
        rows: [
            [item("uranium-ore"), itemCount("uranium-235", 40)],
            [large(40000), g(2, "%")],
            [large(45000), g(8, "%")],
            [large(50000), g(22, "%")],
            [large(55000), g(43, "%")],
            [large(60000), g(64, "%")],
            [large(65000), g(81, "%")],
            [large(70000), g(92, "%")],
            [large(75000), g(97, "%")],
            [large(80000), g(99, "%")]
        ]
    });

    basicTable({
        title: "Runtime from a Nuclear Patch",
        origin: "",
        rows: [10, 25, 50, 100, 250, 500, 1000, 1500].map(n => n * 1000),
        rowHeader: n => itemCount("uranium-ore", n),
        cols: [1, 2, 4, 8, 12, 20],
        colHeader: n => itemCount("nuclear-reactor", n),
        cell: (patchSize, nReactors) => {
            const fuelCells = 630 / 10000 * patchSize;
            const reactorSeconds = fuelCells * 200;
            const seconds = reactorSeconds / nReactors;
            return long_time(seconds);
        }
    });
}

/******* Mining ***********/
//  Regular ores come out at 0.525/s, stone at 0.65/s
//  Steel / electric furnaces are twice as fast
//  Iron/copper plate smelts at 1 ore / 3.5s
//  
//  Stone brick smelts 2 ore / 3.5s
//  Steel / electric furnaces are twice as fast
staticTable({
    title: "Miners per Furnace",
    rows: [
        [text("Output"), item("stone-furnace"), itemGroup("steel-furnace", "electric-furnace")],
        [itemGroup("iron-plate", "copper-plate"),
        ratio(itemCount("electric-mining-drill", 6), itemCount("stone-furnace", 11)),
        ratio(itemCount("electric-mining-drill", 12), itemCount("steel-furnace", 11))],

        [item("stone-brick"),
        ratio(itemCount("electric-mining-drill", 7), itemCount("stone-furnace", 8)),
        ratio(itemCount("electric-mining-drill", 7), itemCount("steel-furnace", 4))]
    ]
})

function groupBy<T, K>(items: T[], keyFunc: (x: T) => K): { key: K; items: T[] }[] {
    const outputs: { key: K; items: T[] }[] = [];
    for (const item of items) {
        const key = keyFunc(item);
        let group: { key: K; items: T[] } | undefined = undefined;
        for (const g of outputs) {
            if (g.key === key) {
                group = g;
                break;
            }
        }
        if (group === undefined) {
            outputs.push({ key, items: [item] });
        } else {
            group.items.push(item);
        }
    }
    return outputs;
}

/******* Assemblers and Belts ***********/
const interestingRecipes: string[] = [
    "transport-belt", "fast-transport-belt", "express-transport-belt",
    "inserter",
    "rail", "assembling-machine-1", "assembling-machine-2",
    "electronic-circuit", "processing-unit", "advanced-circuit",
    "rocket-fuel", "low-density-structure", "rocket-control-unit"
];
const recipeList = Object.keys(recipes).map(k => recipes[k]).filter(r => interestingRecipes.indexOf(r.name) >= 0);
recipeList.sort((a, b) => interestingRecipes.indexOf(a.name) - interestingRecipes.indexOf(b.name));
const recipeGroups = groupBy(recipeList, r => r.energy);
recipeGroups.sort((a, b) => a.key - b.key);
doubleRowHeaderTable({
    title: "Assemblers to Fill a Belt",
    origin1: "Recipe / Speed",
    origin2: "Belt",
    cell: (r1, r2, c) => {
        return Math.ceil(r2.throughput * (r1.key / c.speed));
    },
    cols: Assemblers,
    rows1: recipeGroups,
    rows2: Belts,
    row1Header: r => g(p(r.key + 's'), itemGroup(...r.items.map(i => i.name))),
    row2Header: r => item(r.name)
});

const itemListforStacks: Array<[string, string[]]> = [
    ["Ores", ["iron-ore", "copper-ore", "coal", "stone", "uranium-ore"]],
    ["Smelted", ["iron-plate", "steel-plate", "copper-plate", "stone-brick", "uranium-235", "uranium-238"]],
    ["Intermediates", ["copper-cable", "electronic-circuit", "advanced-circuit", "battery", "science-pack-1", "processing-unit", "plastic-bar", "iron-gear-wheel", "engine-unit", "electric-engine-unit", "speed-module"]],
    ["Logistics", ["transport-belt", "pipe", "rail", "repair-pack", "stone-wall", "splitter", "pipe-to-ground", "rail-signal", "rail-chain-signal", "train-stop"]],
    ["Power", ["small-electric-pole", "medium-electric-pole", "big-electric-pole", "substation", "solar-panel", "accumulator", "small-lamp"]],
    ["Trains", ["locomotive", "cargo-wagon", "fluid-wagon"]],
    ["Tiles", ["concrete", "hazard-concrete", "landfill"]],
    ["Ammo", ["piercing-rounds-magazine", "shotgun-shell", "cannon-shell", "explosive-rocket"]],
    ["Other Weapons", ["grenade", "cluster-grenade", "atomic-bomb", "land-mine"]],
    ["Rocket Parts", ["low-density-structure", "rocket-control-unit", "rocket-fuel", "satellite"]],
    ["Space", ["space-science-pack"]]
];

header("Storage and Transport");
namespace StorageTables {
    function makeStackSizeTable(): Displayable[][] {
        const result: Displayable[][] = [];
        result.push(["Category", "Items", "Size"]);

        for (let i = 0; i < itemListforStacks.length; i++) {
            let sizes: number[] = [];
            let outputs: string[][] = [];
            for (let j = 0; j < itemListforStacks[i][1].length; j++) {
                let size = items[itemListforStacks[i][1][j]].stack_size;
                let idx = sizes.indexOf(size);
                if (idx < 0) {
                    idx = sizes.push(size) - 1;
                    outputs.push([]);
                }
                outputs[idx].push(itemListforStacks[i][1][j]);
            }
            for (let j = 0; j < sizes.length; j++) {
                result.push([itemListforStacks[i][0], itemGroup(...outputs[j]), sizes[j]]);
            }
        }
        return result;
    }

    /******* Stack sizes ***********/
    staticTable({
        title: "Stack Sizes",
        description: [
            "Stack sizes for common items.",
            "Higher-tier items (e.g. red belts) always have the same stack size as their lower-tier counterparts."
        ],
        rows: makeStackSizeTable()
    });

    /******* Storage ***********/
    const goodNumbers = [0.5, 1, 2, 4, 8, 16, 32, 64, 128, undefined];
    basicTable({
        origin: text("#"),
        title: "Storage Capacities",
        description: [
            "How many items can N of each container hold?",
            "This table shows item counts for items with stack size 100.",
            "For items of stack size 50, look up one row.",
            "For items of stack size 200, look down row.",
        ],
        cols: Boxes,
        rows: goodNumbers,
        rowHeader: c => c === undefined ? text("(slots)") : toElement(c),
        cell: (row, col) => {
            if (row === undefined) {
                return integer(col.size);
            }
            return large(row * col.size * 100);
        }
    });

    namespace TrainLoadTime {
        // Basic, Fast, Stack (chest-to-chest)
        const speeds = [2.5, 6.93, 27.7];
        const reps = ["low-density-structure", "iron-ore", "iron-plate", "electronic-circuit"];
        const sizes = [10, 50, 100, 200];
        doubleRowHeaderTable({
            title: "Train Load Time",
            origin1: 'Stack Size',
            origin2: '# of inserters',
            cols: [item("inserter"), item("fast-inserter"), item("stack-inserter")],
            rows1: sizes,
            rows2: [1, 4, 6, 8, 10, 12],
            row1Header: (r, ri) => itemCount(reps[ri], sizes[ri]),
            cell: (r1, r2, c, ri1, ri2, ci) => {
                return short_time(r1 * 40 / (speeds[ci] * r2));
            }
        });
    }
}

header("Oil Processing");
namespace OilProcessingTables {
    const baseLiqRatio = [
        1 / 3, // Pump
        50, // Coal to refineries
        25, // Refineries
        3, // Heavy crack
        9, // Light crack
        8.75, // Coal to chem plants
        7, // Coal plants
        17.5 // Plastic output
    ]
    /******* Pure coal to Plastic ***********/
    // https://docs.google.com/spreadsheets/d/1VzSvviSJdFffIQPJJCHYEy11BlT36NWPieb_yaEcnGk/edit?usp=sharing
    basicTable({
        title: "Coal to Plastic",
        noRowHeader: true,
        rows: [1 / 3, 1, 2, 3, 4, 5],
        cols: [item("offshore-pump"),
        item("coal"),
        item("oil-refinery"),
        item("heavy-oil-cracking"),
        item("light-oil-cracking"),
        item("coal"),
        item("chemical-plant"),
        item("plastic-bar")],
        cell: (r, c, ri, ci) => {
            if (ci === baseLiqRatio.length - 1) {
                return fixed(r * baseLiqRatio[ci]);
            } else {
                return ceil(r * baseLiqRatio[ci]);
            }
        }
    });

    const baseAdvancedToFuelRatio = [
        1, // Water (actual value: 28.75, TBD)
        50, // Oil consumed
        25, // Refineries (advanced)
        5, // Heavy Cracking
        63, // Light to fuel,
        33, // Gas to fuel
        40 // Output
    ];
    basicTable({
        title: "Advanced Oil Processing for Solid Fuel",
        rows: [1 / 25, 5 / 25, 10 / 25, 15 / 25, 20 / 25, 1],
        cols: [item("offshore-pump"), item("crude-oil"), item("oil-refinery"), item("heavy-oil-cracking"), item("solid-fuel-from-light-oil"), item("solid-fuel-from-petroleum-gas"), item("solid-fuel")],
        noRowHeader: true,
        cell: (r, c, ri, ci) => {
            return ceil(r * baseAdvancedToFuelRatio[ci]);
        }
    });

    const baseBasicToFuelRatio = [
        25, // Refineries (basic)
        50, // Oil consumed
        18, // Heavy to fuel
        36, // Light to Fuel
        24, // Gas to fuel
        32.5 // Output
    ];
    basicTable({
        title: "Basic Oil Processing for Solid Fuel",
        rows: [1 / 25, 6 / 25, 10 / 25, 15 / 25, 20 / 25, 1, 31 / 25],
        cols: [item("oil-refinery"), item("crude-oil"), item("solid-fuel-from-heavy-oil"), item("solid-fuel-from-light-oil"), item("solid-fuel-from-petroleum-gas"), item("solid-fuel")],
        noRowHeader: true,
        cell: (r, c, ri, ci) => {
            if (ci === 5) {
                return fixed(r * baseBasicToFuelRatio[ci])
            } else {
                return ceil(r * baseBasicToFuelRatio[ci])
            }
        }
    });

    const baseOilToGasRatio = [
        0.1, // Pumps
        5, // Refineries
        1, // Heavy cracking,
        7, // Light cracking
        90, // Gas/s
    ];
    basicTable({
        title: "Oil Processing for Petroleum Gas",
        rows: [1, 2, 3, 4, 5, 10, 15, 20],
        cols: [item("offshore-pump"), item("oil-refinery"), item("heavy-oil-cracking"), item("light-oil-cracking"), item("petroleum-gas")],
        noRowHeader: true,
        cell: (r, c, ri, ci) => {
            return ceil(r * baseOilToGasRatio[ci]);
        }
    });
}

header("Advanced Mining");
namespace AdvancedMiningTables {
    const miners = [{
        speed: 1.0,
        prod: 0.0,
        header: () => item("electric-mining-drill")
    },
    {
        speed: 2.5,
        prod: 0.0,
        header: () => g(item("electric-mining-drill"), "+", itemCount("speed-module-3", 3))
    },
    {
        speed: 2.0 * 0.85,
        prod: 0.1,
        header: () => g(item("electric-mining-drill"), "+", itemCount("speed-module-3", 2), itemCount("productivity-module-3", 1))
    },
    {
        speed: 1.5 * 0.70,
        prod: 0.2,
        header: () => g(item("electric-mining-drill"), "+", itemCount("speed-module-3", 1), itemCount("productivity-module-3", 2))
    },
    {
        speed: 0.65,
        prod: 0.3,
        header: () => g(item("electric-mining-drill"), "+", itemCount("productivity-module-3", 3))
    }
    ];

    basicTable({
        title: "Miners per Belt (with Productivity / Speed)",
        description: [
            "How many drills does it take to fill both lanes of a blue belt with iron, copper, or coal?",
            "Stone patches need 20% fewer drills due to higher mining speed.",
            "To fill a red belt instead, multiply by 2/3. To fill a yellow belt instead, multiply by 1/3."
        ],
        origin: "Mining Productivity",
        rows: [0, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3],
        cols: miners,
        colHeader: ch => {
            return ch.header();
        },
        rowHeader: r => wholePercent(r),
        cell: (row, col) => {
            const output = 0.525 * (1 + row + col.prod) * col.speed;
            const target = 40;
            return ceil(target / output);
        }
    });

    namespace MineLongevity {
        const sizes = [25000, 50000, 100000, 500000, 1000000, 2000000, 5000000, 10000000];
        const counts = [1, 5, 10, 25, 50, 100];
        basicTable({
            title: "Ore Patch Longevity",
            rows: sizes,
            rowHeader: r => large(r),
            cols: counts,
            colHeader: r => itemCount("electric-mining-drill", r),
            origin: item("iron-ore"),
            cell: (size, count) => {
                return time((size / count) / 0.525);
            }
        });
    }
}

namespace TrainsNeeded {
    // Dwell time is time spent at station
    // Travel time is time in transit

}

namespace Landfill {
    // Takes 20 stone to make 1 landfill
    // 1 chunk = 32x32
    // You can run 25 tiles per second with 6 exoskeletons
    // Cars have 80 storage slots
    // Landfill stack size is 100
    // You can fill 10 tiles per step

    basicTable({
        title: "Landfilling a Lake",
        rows: [1, 5, 25, 50, 100, 500, 1000],
        cols: [item("stone"), "Trips", "Time"],
        origin: "Lake Size (Chunks)",
        cell: (r, c, ri, ci) => {
            switch (ci) {
                case 0:
                    return large(r * 32 * 32 * 20);
                case 1:
                    return ceil(r * 32 * 32 / (80 * 100), false);
                case 2:
                    return short_time(r * 32 * 32 / (10 * 25 * 0.8));
            }
        }
    });
}

namespace CompressionRatios {
    // The *stack* compression ratio is how many stacks of inputs
    //  it takes to create one stack of output.
    // The *belt* compression ratio is how many items of inputs
    //  it takes to create an item of output.
    // The module-adjusted ratio is the same except with
    //  taking productivity modules into account

    function computeStackRatio(r: Recipe) {
        const output = (r.products[0] as InputOrOutputDeterministic);
        // Fraction of a stack produced per output
        const stackFractionPerOutput = output.amount / items[output.name].stack_size;
        let inputStackFraction = 0;
        for (const input of r.ingredients) {
            const inp = input as InputOrOutputDeterministic;
            if (inp.type === 'fluid') continue;
            inputStackFraction += inp.amount / items[inp.name].stack_size;
        }
        return inputStackFraction / stackFractionPerOutput;
    }

    function computeBeltRatio(r: Recipe) {
        const output = (r.products[0] as InputOrOutputDeterministic);
        // Fraction of a stack produced per output
        const stackFractionPerOutput = output.amount;
        let inputStackFraction = 0;
        for (const input of r.ingredients) {
            const inp = input as InputOrOutputDeterministic;
            if (inp.type === 'fluid') continue;
            inputStackFraction += inp.amount;
        }
        return inputStackFraction / stackFractionPerOutput;
    }

    const recipesToMeasure = [
        'iron-plate',
        'steel-plate',
        'copper-cable',
        'iron-gear-wheel',
        'electronic-circuit',
        'advanced-circuit',
        'processing-unit',
        'battery',
        'engine-unit',
        'electric-engine-unit',
        'electric-furnace',
        'assembling-machine-1',
        'inserter',
        'electric-mining-drill',
        'low-density-structure',
        'rocket-control-unit',
        'rocket-fuel',
        'satellite'
    ];
    basicTable({
        title: "Compression Ratios",
        rows: recipesToMeasure,
        cols: ["Stack", "Belt"],
        rowHeader: item,
        origin: "",
        cell: (r, c) => {
            var n: number;
            if (c === "Stack") {
                n = computeStackRatio(recipes[r]);
            } else {
                n = computeBeltRatio(recipes[r]);
            }
            if (n === Math.ceil(n)) {
                return integer(n);
            } else {
                return fixed(n);
            }
        }
    })
}

function roundError(n: number) {
    const m = 1 << 7;
    return Math.round(n * m) / m;
}

function isAlmostInteger(n: number) {
    return Math.abs(n - Math.floor(n)) < 0.00000001;
}

function sum(arr: number[]): number;
function sum<T>(arr: T[], reduce: (el: T) => number): number;
function sum(arr: any[], reduce?: (el: any) => number) {
    let res = 0;
    for (const el of arr) {
        res += reduce ? reduce(el) : el;
    }
    return res;
}

function min(arr: number[]): number;
function min<T>(arr: T[], reduce: (el: T, i: number) => number): number;
function min(arr: any[], reduce?: (el: any, i: number) => number) {
    let res = Infinity;
    let i = 0;
    for (const el of arr) {
        const n = reduce ? reduce(el, i) : el;
        if (n < res) res = n;
        i++;
    }
    return res;
}

function max(arr: number[]): number;
function max<T>(arr: T[], reduce: (el: T, i: number) => number): number;
function max(arr: any[], reduce?: (el: any, i: number) => number) {
    let res = -Infinity;
    let i = 0;
    for (const el of arr) {
        const n = reduce ? reduce(el, i) : el;
        if (n > res) res = n;
        i++;
    }
    return res;
}


interface RecipeCost {
    [itemName: string]: number;
}

function tab(level: number) {
    return new Array(level + 1).join('  ');
}

function increment(map: { [x: string]: number }, key: string, amount: number) {
    map[key] = (map[key] || 0) + amount;
}

function mapMap<T, U>(map: { [key: string]: T; }, fn: (value: T, key: string) => U) {
    const result: { [key: string]: U } = {};
    for (const k of Object.keys(map)) {
        result[k] = fn(map[k], k);
    }
    return result;
}

function computeRecipeCost(recipeName: string, intermediateItemNames: string[]) {
    let level = 0;
    const result: RecipeCost = {};
    getIntermediateInputs(recipes[recipeName]);
    return result;

    function getIntermediateInputs(r: Recipe, amount = 1) {
        const outputs = r.products as InputOrOutputDeterministic[];
        let outputFactor = outputs[0].amount;

        if (r.name === 'copper-cable') outputFactor *= 1.4;
        level++;
        for (const ing of r.ingredients) {
            // Find some recipe that produces this as an output
            const recs = Object.keys(recipes).map(k => recipes[k]).filter(r => r.products.some(o => o.name === ing.name));

            if (ing.type === "fluid") {
                // Find the barreling recipe
                const barrelRecs = recs.filter(r => r.category === "crafting-with-fluid" && r.products.some(i => i.name === "empty-barrel"));
                if (barrelRecs.length !== 1) throw new Error("Too many barreling recipes?");
                const br = barrelRecs[0];
                const fluid = br.products.filter(i => i.name === ing.name)[0] as InputOrOutputDeterministic;
                const barrel = br.products.filter(i => i.name !== ing.name)[0] as InputOrOutputDeterministic;
                increment(result, br.ingredients[0].name, amount * ing.amount / fluid.amount);
                increment(result, barrel.name, amount * ing.amount / fluid.amount);
            } else {
                if (intermediateItemNames.indexOf(ing.name) >= 0) {
                    increment(result, ing.name, amount * ing.amount / outputFactor);
                } else {
                    let foundIt = false;
                    for (const rec of recs) {
                        if (rec.ingredients.every(i => i.type !== 'fluid')) {
                            getIntermediateInputs(rec, ing.amount);
                            foundIt = true;
                            break;
                        }
                    }
                    if (!foundIt) {
                        throw new Error(`Didn't find any recipes to produce ${ing.name}`);
                    }
                }
            }
        }
        level--;
    }

}

namespace IntegerStacks {
    export const intermediates: string[] = ["electronic-circuit",
        "iron-plate",
        "iron-gear-wheel",
        "advanced-circuit",
        "copper-plate",
        "plastic-bar",
        "engine-unit",
        "coal",
        "steel-plate",
        "electric-engine-unit",
        "electric-mining-drill",
        "processing-unit",
        "battery",
        "stone-brick",
        "electric-furnace",
        "gun-turret",
        "sulfuric-acid-barrel",
        "solid-fuel",
        "assembling-machine-1",
        "speed-module",
        "rocket-fuel",
        "solar-panel",
        "accumulator",
        "low-density-structure",
        "empty-barrel"
    ];
    const recipeNames = [
        "electronic-circuit",
        "science-pack-1",
        "science-pack-2",
        "science-pack-3",
        "gun-turret",
        "military-science-pack",
        "electric-furnace",
        "advanced-circuit",
        "production-science-pack",
        "processing-unit",
        "speed-module",
        "high-tech-science-pack",
        "solar-panel",
        "accumulator",
        "low-density-structure",
        "rocket-control-unit",
        "rocket-part",
        "radar"
    ];
}

namespace CargoRatios {
    function computeAllocation(recipe: string) {
        const unitCost = computeRecipeCost(recipe, IntegerStacks.intermediates);
        const stackCost = mapMap(unitCost, (c, n) => {
            return c / items[n].stack_size;
        });
        const minimumStackAlloc = sum(Object.keys(stackCost), k => stackCost[k]);
        const minimumMultiplier = roundError(40 / minimumStackAlloc);

        const names: string[] = Object.keys(unitCost).sort();
        let realAlloc: number[] = [];

        for (const input of names) {
            realAlloc.push(1);
        }

        let lastBottleneckCount = -100;
        let lastPerfect: undefined | number[] = undefined;
        let remainingSlots = 40 - sum(realAlloc);

        let improved = true;
        let smallestOutput = getSmallestOutput();
        while (improved && (remainingSlots > 0)) {
            improved = false;
            let constrainedIndices: number[] = [];
            for (let i = 0; i < realAlloc.length; i++) {
                if (roundError(loadFactor(i)) === 1) {
                    constrainedIndices.push(i);
                }
            }
            if (constrainedIndices.length <= remainingSlots) {
                for (const i of constrainedIndices) {
                    realAlloc[i]++;
                    remainingSlots--;
                }
                improved = true;
            }

            const bottleneckCount = names.filter((n, i) => outputFrom(i) === getSmallestOutput()).length;
            if (bottleneckCount >= lastBottleneckCount) {
                lastPerfect = realAlloc.slice();
                lastBottleneckCount = bottleneckCount;
            }
        }

        if (lastPerfect) {
            realAlloc = lastPerfect;
        }

        return ({
            output: getSmallestOutput() * (recipes[recipe].products[0] as InputOrOutputDeterministic).amount,
            realAlloc,
            names,
            quantity: names.map((_, i) => quantity(i)),
            leftover: names.map((_, i) => leftover(i)),
        });

        function quantity(index: number) {
            return realAlloc[index] * items[names[index]].stack_size;
        }

        function leftover(index: number) {
            const available = quantity(index);
            const consumed = 0;
            return available - Math.floor(getSmallestOutput()) * unitCost[names[index]];
        }

        function loadFactor(index: number) {
            return outputFrom(index) / getSmallestOutput();
        }

        function getSmallestOutput() {
            return min(realAlloc, (r, i) => outputFrom(i));
        }

        function outputFrom(index: number) {
            return quantity(index) / unitCost[names[index]];
        }
    }

    const recipeNames = [
        "electronic-circuit",

        "science-pack-1",
        "science-pack-2",

        "engine-unit",
        "electric-mining-drill",
        "science-pack-3",

        "battery",
        "speed-module",
        "processing-unit",
        "high-tech-science-pack",

        "assembling-machine-1",
        "electric-furnace",
        "production-science-pack",

        "solar-panel",
        "accumulator",
        "satellite"
    ];

    doubleRowHeaderTable({
        title: "Stack Ratios for Mixed Cargo Wagons",
        rows1: recipeNames,
        getRow2: recipe => {
            const unitCost = computeRecipeCost(recipe, IntegerStacks.intermediates);
            return Object.keys(unitCost).sort().map(item);
        },
        cols: ["Stacks", "Quantity", "Leftover"],
        row1Header: r => {
            const { output } = computeAllocation(r);
            return itemCount(r, Math.floor(output));
        },
        origin1: "Recipe",
        origin2: "Input",
        cell: (recipe, row2, col, r1i, r2i, colIndex) => {
            const {
                realAlloc,
                names,
                quantity,
                leftover
            } = computeAllocation(recipe);
            const cost = realAlloc[r2i];
            const itemName = names[r2i];
            switch (col) {
                case "Stacks": return realAlloc[r2i];
                case "Quantity": return itemCount(itemName, quantity[r2i]);
                case "Leftover": return roundError(Math.round(leftover[r2i])) || "";
                default: return "???";
            }
        }
    });
}

header("Advanced Trains");
namespace AdvancedTrainTables {
    // TOOD: Seems high?
    basicTable({
        title: "Refuel Intervals",
        origin: "Stacks",
        description: [
            "How long can a train go between refuelings?"
        ],
        rows: Fuels,
        cols: [1, 2, 3],
        cell: (fuel, stackCount) => {
            // 600 = 600 kW consumption of trains
            const seconds = fuel.energy * stackCount * fuel.stackSize / (600)
            // Trains consume 600kW
            return time(seconds);
        }
    });

    basicTable({
        title: "Fuel Requirements per Minute",
        origin: "",
        description: [
            "How much of each fuel type are consumed by N active locomotives per minute?",
            "Note that you'll need to count locomotives, not trains, and manually estimate how many are active on average"
        ],
        cols: Fuels,
        rows: [10, 25, 50, 100, 250],
        rowHeader: n => itemCount("locomotive", n),
        cell: (trainCount, fuel) => {
            // Trains consume 600kW
            const consumption = Math.ceil((trainCount * 600 * 60) / fuel.energy);
            return itemCount(fuel.name, consumption);
        }
    });
}
