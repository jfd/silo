#!/usr/bin/env node
import ChildProcess from "child_process";
import Path from "path";
import Url from "url";

const runContext = Promise.resolve()
    .then(() => {
        const path = Url.parse(import.meta.url).pathname;
        const dirname = Path.dirname(path);

        if (!process.env["__SILO_PARENT_PID__"]) {
            const loader = Path.join(dirname, "loader.mjs");
            const env = Object.assign({__SILO_PARENT_PID__: process.pid}, process.env);
            const execArgv = ["--experimental-loader", loader];

            const proc = ChildProcess.fork(path, process.argv.slice(2), {env, execArgv});

            proc.on("exit", (code) => {
                return process.exit(code);
            });

            return;
        }

        if ("SILO_INSTALL_PATH" in process.env === false) {
            process.env["SILO_INSTALL_PATH"] = dirname;
        }

        if (process.env["SILO_DEBUG"]) {
            console.log(`Install path: ${process.env["SILO_INSTALL_PATH"]}`);
        }

        return import(Path.join(dirname, "src", "App.mjs"))
            .then((App) => {
                return App.default(process.argv.slice(2));
            })
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
