import type { Config } from "../config.ts";
import type { Db } from "../db/index.ts";
import type { PlantModel } from "../ai/model.ts";

export interface Deps { cfg: Config; db: Db; model: PlantModel }
