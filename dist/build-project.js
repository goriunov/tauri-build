"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProject = void 0;
const cli_1 = require("@tauri-apps/cli");
const path_1 = require("path");
const tiny_glob_1 = __importDefault(require("tiny-glob"));
const core = __importStar(require("@actions/core"));
const child_process_1 = require("child_process");
function buildProject(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const args = options.args || [];
        if (options.debug) {
            args.push('--debug');
        }
        if (options.configPath) {
            args.push('--config', options.configPath);
        }
        if (options.target) {
            args.push('--target', options.target);
        }
        if (options.projectPath) {
            const newCwd = (0, path_1.resolve)(process.cwd(), options.projectPath);
            core.debug(`changing working directory: ${process.cwd()} -> ${newCwd}`);
            process.chdir(newCwd);
        }
        if (options.runner) {
            core.info(`running ${options.runner} with args: build ${args.join(' ')}`);
            yield spawnCmd(options.runner, ['build', ...args]);
        }
        else {
            core.info(`running builtin runner with args: build ${args.join(' ')}`);
            yield (0, cli_1.run)(['build', ...args], '');
        }
        const crateDir = yield (0, tiny_glob_1.default)(`./**/Cargo.toml`).then(([manifest]) => (0, path_1.join)(process.cwd(), (0, path_1.dirname)(manifest)));
        const metaRaw = yield execCmd('cargo', ['metadata', '--no-deps', '--format-version', '1'], { cwd: crateDir });
        const meta = JSON.parse(metaRaw);
        const targetDir = meta.target_directory;
        const profile = options.debug ? 'debug' : 'release';
        const bundleDir = options.target
            ? (0, path_1.join)(targetDir, options.target, profile, 'bundle')
            : (0, path_1.join)(targetDir, profile, 'bundle');
        const macOSExts = ['app', 'app.tar.gz', 'app.tar.gz.sig', 'dmg'];
        const linuxExts = [
            'AppImage',
            'AppImage.tar.gz',
            'AppImage.tar.gz.sig',
            'deb'
        ];
        const windowsExts = ['exe', 'exe.zip', 'exe.zip.sig', 'msi', 'msi.zip', 'msi.zip.sig'];
        const artifactsLookupPattern = `${bundleDir}/*/!(linuxdeploy)*.{${[
            ...macOSExts,
            linuxExts,
            windowsExts
        ].join(',')}}`;
        core.debug(`Looking for artifacts using this pattern: ${artifactsLookupPattern}`);
        const artifacts = yield (0, tiny_glob_1.default)(artifactsLookupPattern, {
            absolute: true,
            filesOnly: false
        });
        let i = 0;
        for (const artifact of artifacts) {
            if (artifact.endsWith('.app') &&
                !artifacts.some(a => a.endsWith('.app.tar.gz'))) {
                yield execCmd('tar', [
                    'czf',
                    `${artifact}.tar.gz`,
                    '-C',
                    (0, path_1.dirname)(artifact),
                    (0, path_1.basename)(artifact)
                ]);
                artifacts[i] += '.tar.gz';
            }
            else if (artifact.endsWith('.app')) {
                // we can't upload a directory
                artifacts.splice(i, 1);
            }
            i++;
        }
        return artifacts;
    });
}
exports.buildProject = buildProject;
function spawnCmd(cmd, args, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)(cmd, args, Object.assign(Object.assign({}, options), { stdio: ['pipe', 'inherit', 'inherit'], shell: true }));
            child.on('exit', () => resolve);
            child.on('error', error => {
                reject(error);
            });
            if (child.stdin) {
                child.stdin.on('error', error => {
                    reject(error);
                });
            }
        });
    });
}
function execCmd(cmd, args, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(`${cmd} ${args.join(' ')}`, Object.assign(Object.assign({}, options), { encoding: 'utf-8' }), (error, stdout, stderr) => {
                if (error) {
                    console.error(`Failed to execute cmd ${cmd} with args: ${args.join(' ')}. reason: ${error}`);
                    reject(stderr);
                }
                else {
                    resolve(stdout);
                }
            });
        });
    });
}
