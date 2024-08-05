import { ensureLogger, type Logger } from "@fireproof/core";
import { SQLOpts, SQLTableNames, DefaultSQLTableNames, SQLGestalt } from "./types";
import { URI } from "@adviser/cement";

function sqlTableName(...names: string[]): string {
  return names
    .map((name) => name.replace(/^[^a-zA-Z0-9]+/, "").replace(/[^a-zA-Z0-9]+/g, "_"))
    .filter((i) => i.length)
    .join("_");
}

function ensureTableNames(url: URI, opts?: Partial<SQLOpts>): SQLTableNames {
  let isIndex = "";
  if (url.hasParam("index")) {
    isIndex = url.getParam("index") || ".idx";
  }
  const ret = opts?.tableNames || DefaultSQLTableNames;
  // console.log("isIndex->", opts?.url, isIndex, sqlTableName(isIndex,  ret.data));
  if (isIndex.length) {
    return {
      data: sqlTableName(isIndex, ret.data),
      meta: sqlTableName(isIndex, ret.meta),
      wal: sqlTableName(isIndex, ret.wal),
    };
  }
  return {
    data: sqlTableName(ret.data),
    meta: sqlTableName(ret.meta),
    wal: sqlTableName(ret.wal),
  };
}

const textEncoder = new TextEncoder();
function ensureTextEncoder(opts?: Partial<SQLOpts>): TextEncoder {
  return opts?.textEncoder || textEncoder;
}

const textDecoder = new TextDecoder();
function ensureTextDecoder(opts?: Partial<SQLOpts>): TextDecoder {
  return opts?.textDecoder || textDecoder;
}

function url2sqlFlavor(url: URI, logger: Logger): SQLGestalt {
  const flavor = url.protocol.replace(/:.*$/, "");
  switch (flavor) {
    case "sqlite":
      return {
        flavor: "sqlite",
        version: url.getParam("version"),
        taste: url.getParam("taste"),
      };
    default:
      throw logger.Error().Str("flavor", flavor).Msg("unsupported protocol").AsError();
  }
}

export function ensureSQLOpts(
  url: URI,
  opts: Partial<SQLOpts>,
  componentName: string,
  ctx?: Record<string, unknown>
): SQLOpts {
  const logger = ensureLogger(opts, componentName, ctx);
  return {
    url,
    sqlGestalt: url2sqlFlavor(url, logger),
    tableNames: ensureTableNames(url, opts),
    logger,
    textEncoder: ensureTextEncoder(opts),
    textDecoder: ensureTextDecoder(opts),
  };
}
