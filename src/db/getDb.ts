import { cache } from "react";
import { createDb, resolveD1 } from "./index";

export const getDb = cache(async () => createDb(await resolveD1()));
