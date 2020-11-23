import ChildProcess from "child_process";

import {List} from "//es.parts/ess/0.0.1/";
import {Path} from "//es.parts/ess/0.0.1/";
import {Str} from "//es.parts/ess/0.0.1/";
import {Url} from "//es.parts/ess/0.0.1/";

import {Docopt} from "//es.parts/docopt/0.0.1/";

const USAGE = `
Usage:
    silo-build [options] [<path>]

Options:
    -h, --help               Print this message
        --format=FORMAT      Output format, default: cjs
        --output-path=PATH   Output path, default: "./dist/app.js"
`;

export default function(argv) {
    const opts = Docopt.parse(USAGE, argv);

    let inputPath;

    if (opts["<path>"]) {
        inputPath = Path.resolve(process.cwd(), opts["<path>"]);
    } else {
        inputPath = Path.resolve(process.cwd(), "index.mjs");
    }

    const outputPath = opts["--output-path"] || "dist/app.js";
    const format = opts["--format"] || "cjs";

    return internalExec(inputPath, outputPath, format);
}

// Internals

async function internalExec(inputPath, outputPath, format) {
    const url = Url.parse(import.meta.url);
    const rootdir = Path.dirname(Path.dirname(url.pathname));
    const rollupPath = Path.resolve(rootdir, "./node_modules/rollup/dist/bin/rollup");
    const loaderPath = Path.resolve(rootdir, "./src/RollupModuleLoader.js");

    let args = [
        rollupPath,
        inputPath,
        `--file ${outputPath}`,
        `--format ${format}`,
        `--plugin ${loaderPath}`
    ];

    if (format === "cjs") {
        args = List.append(args, `--outro "${outroLauncher().split("\n").join(" ")}"`);
    }

    try {
        const result = await promiseExec(Str.join(args, " "));
        console.log(result);
    } catch (error) {
        console.error(error);
    }
}

function promiseExec(cmd) {
    return new Promise((resolve, reject) => {
        ChildProcess.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }

            resolve(stdout);
        });
    });
}

function outroLauncher() {
    return `
        (async function() {
            try {
                await module.exports(process.argv.slice(2));
            } catch (error) {
                if (error.appMessage) {
                    console.error(error.appMessage);
                    return process.exit(error.appExitCode || 1);
                }
                console.log(error);
                return process.exit(1);
            }
        })();
    `;
}
