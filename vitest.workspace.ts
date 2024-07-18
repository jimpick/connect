import { defineWorkspace } from "vitest/config";

import sqlite from "./vitest.sqlite.config.ts";

export default defineWorkspace([sqlite]);
