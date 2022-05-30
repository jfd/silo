const Fs = require("fs");
const Https = require("https");
const Path = require("path");

const SILO_WORK_DIR = "SILO_WORK_DIR";
const SILO_URL_REWRITE = "SILO_URL_REWRITE";

const State = {
    initialized: false,
    env: process.env,
    rewriteRules: null,
};

module.exports = function silo () {
    return {
        name: "silo", // this name will show up in warnings and errors

        resolveId(specifier) {
            if (specifier.startsWith("//")) {
                const specifier2 = resolveUrlWithRewriteRules(specifier);

                let specifier3 = specifier2;

                if (specifier3.endsWith("/")) {
                    specifier3 = `${specifier3}index.mjs`;
                }

                return specifier3;
            }

            return null;
        }

    };
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

    do {
        const filepath = Path.join(path, ".env");

        if (Fs.existsSync(filepath) === false) {
            continue;
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

    let specifier2 = specifier;

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

        const result = specifier2.replace(rule.regexp, `${rule.path}`);

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
