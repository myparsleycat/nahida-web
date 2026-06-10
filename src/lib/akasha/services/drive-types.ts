import type { Treaty } from "@elysiajs/eden";

import { eden } from "@/lib/eden";

const akashaModIdGet = eden.akasha.mod({ modId: "" }).get;
export type Collections = Treaty.Data<typeof akashaModIdGet>["collections"];
export type AkashaModData = Treaty.Data<typeof akashaModIdGet>;
