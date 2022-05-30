import * as Str from "./Str.mjs";
import * as List from "./List.mjs";
import * as Path from "./Path.mjs";

const USAGE = `
usage: silo [--version] [--help] [--config=<path>] [--work-dir=<path>]
            [--cache-path=<path>] [--show-script-warnings] <command> [<args>]

Built-in commands:
    exec        Run specificed path in an isolated process
    test        Run project tests

See 'silo help <command>' for more information on a specific command.
`;

export default async function(argv) {
    const {options, args, error} = parseOpts(argv);

    if (options.version) {
        return await printVersionThenExit();
    }

    if (options.help || List.empty(args)) {
        return printUsageThenExit();
    }

    const cwd = process.cwd();
    const env = process.env;
    const command = List.head(args);
    const cmdargs = List.tail(args);

    const cmdpath = await resolveCommandPath(command, cwd, env);

    if (cmdpath === null) {
        return printUsageThenExit();
    }

    if (Path.extname(cmdpath, ".mjs")) {
        try {
            await runScript(cmdpath, cmdargs);
        } catch (error) {
            if (error.appMessage) {
                console.error(error.appMessage);
                return process.exit(error.appExitCode || 1);
            }
            console.log(error);
            return process.exit(1);
        }
    }

    // TODO: Boot up a child process with new command

}

// Internals

function printUsageThenExit() {
    console.error(USAGE);
    process.exit(1);
}

async function printVersionThenExit() {
    console.error(`silo version 0.0.1`);
    process.exit(1);
}

function parseOpts(argv) {
    const options = {};

    let idx;

    for (idx = 0; idx < argv.length; idx++) {
        const arg = argv[idx];

        if (Str.begins(arg, "-")) {
            const [opt, param] = arg.split("=");

            switch (opt) {

            default:
                return {error: `Unknown option: ${arg}`};

            case "--version":
                return {options: { version: 1 }};

            case "--help":
                return {options: { help: 1 }};

            case "--config":
                if (!param) {
                    return {error: `Missing argument for --config`};
                }
                options["config"] = param;
                break;

            case "--work-dir":
                if (!param) {
                    return {error: `Missing argument for --work-dir`};
                }
                options["cwd"] = param;
                break;

            case "--cache-path":
                if (!param) {
                    return {error: `Missing argument for "${opt}"`};
                }
                options[opt] = param;
                break;

            case "--show-script-warnings":
                options["show-script-warnings"] = 1;
                break;
            }
        } else {
            break;
        }
    }

    return { options, args: argv.slice(idx) };
}

async function resolveCommandPath(name, cwd, env) {
    const targets = possibleCommandTargets(name, cwd, env);

    for (let target of targets) {
        if (await isFile(target)) {
            return target;
        }
    }

    return null;
}

function homedir(env) {
    return env["HOME"] || env["USERPROFILE"] || null;
}

function possibleCommandTargets(name, cwd, env) {
    const cmd = `silo-${name}`;
    const script = `silo-${name}.mjs`;

    let result = [
        Path.join(cwd, "scripts", cmd),
        Path.join(cwd, "scripts", script),
    ];

    if (homedir(env)) {
        const path = homedir(env);
        result = List.append(result, Path.join(path, "scripts", cmd));
        result = List.append(result, Path.join(path, "scripts", script));
    }

    if ("SILO_INSTALL_PATH" in env) {
        const path = env["SILO_INSTALL_PATH"];
        result = List.append(result, Path.join(path, "scripts", cmd));
        result = List.append(result, Path.join(path, "scripts", script));
    }

    return result;
}

async function isFile(path) {
    const Fs = await import("fs");

    return new Promise((resolve, _) => {
        Fs.stat(path, (err, stats) => resolve(err ? false : stats.isFile()));
    });
}

async function runScript(path, args) {
    const module = await import(path);

    if ("default" in module === false ||
        typeof module["default"] !== "function") {
            throw new Error(`In module "${path}", expected "default" to be a Function`);
    }

    try {
        const result = module["default"](args);

        if (result instanceof Promise) {
            return result;
        }

        return Promise.resolve(result);
    } catch (error) {
        return Promise.reject(error);
    }
}
