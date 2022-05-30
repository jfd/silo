import * as Fs from "fs";
import * as Https from "https";
import * as Path from "path";

export {resolve};
export {getFormat};
export {getSource};

const SILO_WORK_DIR = "SILO_WORK_DIR";
const SILO_URL_REWRITE = "SILO_URL_REWRITE";

const State = {
    initialized: false,
    env: process.env,
    rewriteRules: null,
};

function resolve(specifier, context, defaultResolve) {
    const {parentURL = null} = context;

    let specifier2 = specifier;

    if (specifier2.startsWith("//")) {
        specifier2 = `https:${specifier2}`;
    }

    const specifier3 = resolveUrlWithRewriteRules(specifier2);

    if (specifier3 !== specifier2) { // Did rewrite url
        if (specifier3.endsWith("/")) {
            const specifier4 = `${specifier3}index.mjs`;
            return defaultResolve(specifier4, context, defaultResolve);
        }

        return defaultResolve(specifier3, context, defaultResolve);
    }

    if (specifier2.startsWith('https://')) {
        return {
            url: specifier2
        };
    } else if (parentURL && parentURL.startsWith('https://')) {
        return {
            url: new URL(specifier2, parentURL).href
        };
    }

    return defaultResolve(specifier, context, defaultResolve);
}

function getFormat(url, context, defaultGetFormat) {
    // This loader assumes all network-provided JavaScript is ES module code.
    if (url.startsWith('https://')) {
        return {
            format: 'module'
        };
    }

    // Let Node.js handle all other URLs.
    return defaultGetFormat(url, context, defaultGetFormat);
}

async function getSource(url, context, defaultGetSource) {
    if (process.env["SILO_DEBUG"]) {
        console.log(`Get Source for "${url}"...`);
    }

    // For JavaScript to be loaded over the network, we need to fetch and
    // return it.
    if (url.startsWith('https://')) {
      return new Promise((resolve, reject) => {
          if (process.env["SILO_DEBUG"]) {
              console.log(`Loading external URL: ${url}...`);
          }

          Https.get(url, (res) => {
              let data = "";
              res.on("data", chunk => data += chunk);
              res.on('end', () => {
                  resolve({ source: data })
              });
          }).on('error', (err) => {
              if (process.env["SILO_DEBUG"]) {
                  console.log(`Error loading External URL: ${url}...`);
              }

              return reject(err);
          });
    });
  }

  // Let Node.js handle all other URLs.
  return defaultGetSource(url, context, defaultGetSource);
}

// Internals

function initEnv() {
    if (State.initialized) {
        return;
    }

    State.env = Object.assign(State.env, readDotEnv());
    State.initialized = true;
}

function readDotEnv() {
    let path = process.cwd();

    if (process.env["SILO_DEBUG"]) {
        console.log(`Search for ".env" in directory hierarchy...`);
    }

    do {
        const filepath = Path.join(path, ".env");

        if (Fs.existsSync(filepath) === false) {
            continue;
        }

        if (process.env["SILO_DEBUG"]) {
            console.log(`Loading ".env"-source at ${filepath}...`);
        }

        const content = Fs.readFileSync(filepath, "utf8");
        const rows = content.split("\n");
        const env = {};

        for (let row of rows) {
            const idx = row.indexOf("=");
            const key = row.substr(0, idx);
            const value = row.substr(idx + 1).trimStart();

            if (value[0] === "\"") {
                env[key.trim()] = value.substr(1, value.length - 2);
            } else {
                env[key.trim()] = value;
            }
        }

        return env;
    } while ((path = Path.dirname(path)) !== Path.sep);

    return {};
}

function resolveUrlWithRewriteRules(specifier) {
    if (specifier.startsWith("file://") || specifier.startsWith("./")) {
        return specifier;
    }

    let specifier2;

    if (specifier.startsWith("http:")) {
        specifier2 = specifier.substr("http:".length);
    } else if (specifier.startsWith("https:")) {
        specifier2 = specifier.substr("https:".length);
    }

    const rewriteRules = getRewriteRules();

    const result = rewriteRules.reduce((a, rule) => {
        if (rule.regexp.test(specifier2) === false) {
            return a;
        }

        const result = specifier2.replace(rule.regexp, `file://${rule.path}`);

        if (process.env["SILO_DEBUG"]) {
            console.log(`Rewritting url for "${specifier}" to ${result}`);
        }

        return result;
    }, specifier);

    return result;
}

function getRewriteRules() {
    if (State.rewriteRules !== null) {
        return State.rewriteRules;
    }

    initEnv();

    const expressions = String(State.env[SILO_URL_REWRITE] || "").split(":");

    if (expressions.length === 1 && expressions[0].length === 0) {
        return [];
    }

    const rules = [];

    expressions.forEach(expr => {
        const [expression, path] = expr.split(" ");
        const regexp = new RegExp(expression, "i");
        rules.push({regexp, path});
    });

    State.rewriteRules = rules;

    return rules;
}
