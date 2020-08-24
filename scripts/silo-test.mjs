import {Dict} from "//es.parts/ess/0.0.1/";
import {List} from "//es.parts/ess/0.0.1/";
import {Path} from "//es.parts/ess/0.0.1/";
import {Str} from "//es.parts/ess/0.0.1/";

import {Docopt} from "//es.parts/docopt/0.0.1/";
import {Glob} from "//es.parts/glob/0.0.1/";

const USAGE = `
Usage: silo-test [options] [<pattern>]

Options:
    -h, --help               Print this message
    -v, --verbose            Use verbose output
    -q, --quiet              No output printed to stdout
        --run=MATCH          Run specific tests matching MATCH, default: *
`;

class Metrics {
    constructor() {
        this.total = 0;
        this.success = 0;
        this.failures = 0;
        this.state = {};
    }
}

class Reporter {
    constructor(metrics) {
        this.metrics = metrics;
    }

    begin(path, name) {
        handleTestBegin(this.metrics, path, name);
    }

    end(path, name, result, error) {
        handleTestEnd(this.metrics, path, name, result, error);
    }

    initError(path, error) {
        handleTestEnd(this.metrics, path, INIT_ERROR, "", error);
    }
}

const INIT_ERROR = "**init**";
const PREFIX = "        ";

export default async (argv) => {
    const opts = Docopt.parse(USAGE, argv);
    const metrics = new Metrics;
    const reporter = new Reporter(metrics);

    const pattern = opts["<pattern>"] || "test/*Test.mjs";
    const filter = opts["--run"] || "*";
    const workdir = process.cwd();

    const paths = await Glob.find(pattern, {cwd: workdir});

    if (List.empty(paths)) {
        console.error(`no files matching glob pattern "${pattern}"`);
        return process.exit(1);
    }

    await testModules(workdir, paths, reporter, filter);

    console.log(formatResult(metrics));
}

// Callbacks

function handleTestBegin(metrics, path, name) {
    if (name === "setup" || name === "teardown") {
        return;
    }

    const moduleName = Path.basename(path, ".mjs");
    const text = formatLine(moduleName, name, " ");

    metrics.total++;
    metrics.state[`${path}:${name}`] = {
        time: getTime(),
        spinner: createSpinner(text.substr(0, text.length - 1)),
    };
}

function handleTestEnd(metrics, path, name, status, error) {
    const moduleName = Path.basename(path, ".mjs");

    switch (name) {
    default:
        const state = metrics.state[`${path}:${name}`];
        destroySpinner(state.spinner);
        if (error === null) {
            metrics.success++;
            const t = getTime(state.time);
            const elapsed = (t[0] * 1000) + (t[1] / 1000000);
            const fixed = elapsed.toFixed(2);
            const st = status ? ` -> ${status}` : "";
            console.log(formatLine(moduleName, `${name}${st}`, `ok (${fixed}ms)`));
        } else {
            metrics.failures++;
            console.log(formatLine(moduleName, name, "failed"));
            printErrorStack(error);
        }
        break;

    case "setup":
        if (!error) {
            console.log(`Running test for \x1B[1m${moduleName}\x1B[22m (${path})`);
            return;
        }

        console.log(`Unable to run test for \x1B[1m${moduleName}\x1B[22m (${path}), due to a setup error`);
        metrics.failures++;
        printErrorStack(error);
        break;

    case "teardown":
        break;

    case INIT_ERROR:
        metrics.failures++;
        console.log(`Failed to compile \x1B[1m${moduleName}\x1B[22m (${path})`);
        printErrorStack(error);
        break;
    }
}

// Internals

function printErrorStack(error) {
    let text;

    if (error && "appMessage" in error) {
        text = error.appMessage;
    } else if (error instanceof Error) {
        text = error.stack || error.message;
    } else {
        text = String(error);
    }

    console.log(`${PREFIX}${text.replace(/\n/g, `\n${PREFIX}`)}`);
}

async function testModules(workdir, paths, reporter, filter) {
    for await (let path of paths) {
        const modulePath = Path.resolve(workdir, path);
        await testModule(modulePath, reporter, filter);
    }
}

async function testModule(path, reporter, filter) {
    let exports;

    try {
        exports = await import(path);
    } catch (error) {
        console.error(`Unable to load ${path}, reason: ${error.message}`);
        return;
    }

    const tests = gatherTestsByFilter(exports, filter);

    if (List.len(Dict.keys(tests)) === 0) {
        console.error(`Ignore to run ${path}, no tests matching criteria...`);
        return;
    }

    try {
        const setup = promisfyCallable(exports["setup"]);
        reporter.begin(path, "setup");
        await setup();
        reporter.end(path, "setup", null, null);
    } catch (setupError) {
        reporter.end(path, "setup", null, setupError);
        return;
    }

    const testCases = Dict.map(tests, (k, v) => [k, v]);

    for await (let testCase of testCases) {
        const [name, callback] = testCase;
        const testCallback = promisfyCallable(callback);

        reporter.begin(path, name);

        try {
            const result = await testCallback();
            reporter.end(path, name, result, null);
        } catch (testError) {
            reporter.end(path, name, null, testError || "Unknown error");
        }
    }

    try {
        const teardown = promisfyCallable(exports["teardown"]);
        reporter.begin(path, "teardown");
        await teardown();
        reporter.end(path, "teardown", null, null);
    } catch (teardownError) {
        reporter.end(path, "teardown", null, teardownError);
    }
}

function promisfyCallable(callable) {
    return () => {
        if (typeof callable !== "function") {
            return Promise.resolve();
        }

        try {
            const result = callable();

            if (result instanceof Promise) {
                return result;
            }

            return Promise.resolve(result);
        } catch (error) {
            return Promise.reject(error);
        }
    };
}

function gatherTestsByFilter(candidates, filter) {
    return Dict.filter(candidates, (k, v) => {
        if (typeof v !== "function") {
            return false;
        }

        if (Str.includes(filter, "*")) {
            return Str.begins(k, "test");
        }

        return k === filter;
    });
}

function createSpinner(text) {
    const frames = "|/-\\";

    let frame = 0;
    let current;

    function interval() {
        current = frames[frame % frames.length];
        frame++;
        process.stdout.write("\x1b[2K\r");
        process.stdout.write(`${text}${current}`);
    }

    return setInterval(interval, 100);
}

function destroySpinner(tid) {
    if (tid) {
        process.stdout.write("\x1b[2K\r");
        clearInterval(tid);
    }
}

function formatLine(module, name, status) {
    const totalLen = module.length + name.length +
                     status.length + PREFIX.length + 1;
    const dotLen = 80 - totalLen - 4;
    const dots = Str.repeat(".", dotLen);

    return `${PREFIX}${module}.\x1B[1m${name}\x1B[22m${dots}${status}`;
}

function formatResult(metrics) {
    const {total, success, failures} = metrics;
    return `Total ${total}, success ${success}, failures ${failures}`;
}

function getTime(time) {
    return time ? process.hrtime(time) : process.hrtime();
}
