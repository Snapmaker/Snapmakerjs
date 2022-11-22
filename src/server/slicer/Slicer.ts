import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import childProcess from 'child_process';
import {getPath} from '@snapmaker/snapmaker-lunar';

import {HEAD_PRINTING, PRINTING_CONFIG_SUBCATEGORY} from '../constants';
import DataStorage from '../DataStorage';
import logger from '../lib/logger';
import {generateRandomPathName} from '../../shared/lib/random-utils';
import {Metadata, SliceResult} from './slicer-definitions';
import {processGcodeHeaderAfterCuraEngine, postProcessorV1} from './post-processor';


const log = logger('service:print3d-slice');

/**
 * callCuraEngine
 *
 * @param globalConfig path to global definition
 * @param modelConfigs - information needed to create new model.
 *      [{
 *          modelPath: 'abc',
 *          configPath: 'abc',
 *      }]
 * @param outputPath output file path
 * @returns process
 */
function callEngine(globalConfig, modelConfigs, outputPath) {
    const enginePath = getPath('Slicer');
    const args = ['slice', '-v', '-p', '-o', outputPath.replace(/\\/g, '/')];

    args.push('-j', globalConfig.configPath.replace(/\\/g, '/'));

    for (const modelConfig of modelConfigs) {
        const filePath = modelConfig.modelPath;
        const fileConfig = modelConfig.configPath;
        args.push('-l', filePath.replace(/\\/g, '/'));
        args.push('-j', fileConfig.replace(/\\/g, '/'));
    }
    log.info(`${enginePath} ${args.join(' ')}`);

    return childProcess.spawn(
        enginePath,
        args,
        {
            env: {
                ...process.env,
                CURA_ENGINE_SEARCH_PATH: `${path.resolve(DataStorage.configDir, HEAD_PRINTING)}`
            }
        }
    );
}


/**
 * Slicer class.
 *
 * events:
 *
 * - started
 *
 * - progress
 *
 * - completed
 *
 * - failed
 */
export default class Slicer extends EventEmitter {
    version: number = 0;

    // file path of global definition
    globalDefinition: string;

    // file paths of models
    models: string[];

    // file paths of model definitions
    modelDefinitions: string[];

    // file paths of support models
    supportModels: string[];

    // file path of support models' definition
    // all support models share the same definition
    supportDefinition: string;

    metadata: Metadata;

    constructor() {
        super();

        this.version = 0;

        this.globalDefinition = '';

        this.models = [];
        this.modelDefinitions = [];

        this.supportModels = [];
        this.supportDefinition = '';
    }

    setVersion(version = 0) {
        this.version = version;
    }

    setModels(models: string[]) {
        this.models = models;
    }

    setModelDefinitions(definitions: string[]): void {
        this.modelDefinitions = definitions;
    }

    setSupportModels(models: string[]): void {
        this.supportModels = models;
    }

    setMetadata(metadata: Metadata): void {
        this.metadata = metadata;
    }

    validate(): boolean {
        if (this.models.length !== this.modelDefinitions.length) {
            return false;
        }

        for (let i = 0; i < this.models.length; i++) {
            const modelName = this.models[i];
            const modelPath = `${DataStorage.tmpDir}/${modelName}`;
            if (!fs.existsSync(modelPath)) {
                log.error(`Slice failed: 3D model file does not exist: ${modelPath}`);
                this.emit('failed', `Slice failed: 3D model file does not exist: ${modelPath}`);
                return false;
            }
        }

        for (let i = 0; i < this.supportModels.length; i++) {
            const modelName = this.supportModels[i];
            const modelPath = `${DataStorage.tmpDir}/${modelName}`;

            if (!fs.existsSync(modelPath)) {
                log.error(`Slice failed: 3D model file does not exist: ${modelPath}`);
                this.emit('failed', `Slice failed: 3D model file does not exist: ${modelPath}`);
                return false;
            }
        }

        return true;
    }

    _onSliceProcessData(sliceResult: SliceResult, data): void {
        const array = data.toString()
            .split('\n');

        array.forEach((item) => {
            if (item.length < 10) {
                return;
            }
            if (item.indexOf('[debug]') !== -1) {
                return;
            }

            // progress
            if (item.indexOf('Progress:inset+skin:') === 0 || item.indexOf('Progress:export:') === 0) {
                const start = item.indexOf('0.');
                const end = item.indexOf('%');
                const sliceProgress = Number(item.slice(start, end));
                //onProgress(sliceProgress);
                this.emit('progress', sliceProgress);
            } else if (item.indexOf(';Filament used:') === 0) {
                // single extruder: ';Filament used: 0.139049m'
                // dual extruders: ';Filament used: 0.139049m, 0m'
                const filamentLengthArr = item.replace(';Filament used:', '')
                    .split(',');
                const filamentLength = filamentLengthArr.map(str => Number(str.trim()
                    .replace('m', '')))
                    .reduce((a, b) => a + b, 0);
                // volume (cm^3) * density (PLA: 1.24 g/cm^3)
                const filamentWeight = Math.PI * (1.75 / 2) * (1.75 / 2) * filamentLength * 1.24;

                sliceResult.filamentLength = filamentLength;
                sliceResult.filamentWeight = filamentWeight;
            } else if (item.indexOf(';TIME:') === 0) {
                // Times empirical parameter: 1.07
                sliceResult.printTime = Number(item.replace(';TIME:', '')) * 1.07;
            }
        });
    }

    _postProcess(sliceResult: SliceResult): void {
        if (this.version === 0) {
            const gcodeFileLength = processGcodeHeaderAfterCuraEngine(sliceResult.gcodeFilePath, this.metadata, sliceResult);
            sliceResult.gcodeFileLength = gcodeFileLength;

            this.emit('progress', 1.0);
            this.emit('completed', sliceResult);
        }

        if (this.version === 1) {
            postProcessorV1(sliceResult, this.metadata)
                .then(() => {
                    this.emit('progress', 1.0);
                    this.emit('completed', sliceResult);
                });
        }
    }

    _onSliceProcessClose(sliceResult: SliceResult, code: number): void {
        console.log('sliceResult =', sliceResult);
        if (code === 0) {
            this.emit('progress', 0.95);

            // TODO: why so many parameters passed in here?
            const {renderGcodeFileName: renderName} = this.metadata;
            const renderGcodeFileName = `${renderName}.gcode`;
            sliceResult.renderGcodeFileName = renderGcodeFileName;

            this._postProcess(sliceResult);

        } else {
            this.emit('failed', 'Slicer failed.');
        }
        log.info(`Slicer process exit with code = ${code}`);
    }

    startSlice(): void {
        if (!this.validate()) {
            return;
        }

        const sliceResult = new SliceResult();

        const globalConfig = {
            configPath: path.join(DataStorage.configDir, PRINTING_CONFIG_SUBCATEGORY, 'active_final.def.json'),
        };

        const modelConfigs = [];
        for (let i = 0; i < this.models.length; i++) {
            modelConfigs.push({
                modelPath: path.join(DataStorage.tmpDir, this.models[i]),
                configPath: path.join(DataStorage.tmpDir, this.modelDefinitions[i]),
            });
        }
        for (let i = 0; i < this.supportModels.length; i++) {
            modelConfigs.push({
                modelPath: path.join(DataStorage.tmpDir, this.supportModels[i]),
                configPath: path.join(DataStorage.configDir, PRINTING_CONFIG_SUBCATEGORY, 'support.def.json'),
            })
        }

        const outputFilename = this.metadata.originalName
            ? generateRandomPathName(`${path.parse(this.metadata.originalName).name}.gcode`)
            : generateRandomPathName('model.gcode');
        const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

        sliceResult.gcodeFilename = outputFilename;
        sliceResult.gcodeFilePath = outputFilePath;

        const process = callEngine(globalConfig, modelConfigs, outputFilePath);
        process.stdout.on('data', (data) => this._onSliceProcessData(sliceResult, data));
        process.on('close', (code) => this._onSliceProcessClose(sliceResult, code));
    }
}

