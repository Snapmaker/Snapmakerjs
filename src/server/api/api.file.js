import path from 'path';
import mv from 'mv';
import fs from 'fs';
import store from '../store';
import { pathWithRandomSuffix } from '../lib/random-utils';
import logger from '../lib/logger';
import parseGcodeHeader from '../lib/parseGcodeHeader';
import DataStorage from '../DataStorage';
import { PROTOCOL_TEXT } from '../controllers/constants';

const log = logger('api:file');

export const set = (req, res) => {
    const file = req.files.file;
    const originalName = path.basename(file.name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    console.log('uploadFile,req>>>>', file.path);
    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName,
                uploadName
            });
            res.end();
        }
    });
};

export const uploadCaseFile = (req, res) => {
    const { name, casePath } = req.body;
    const originalName = path.basename(name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    fs.copyFile(path.resolve(casePath, name), uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName,
                uploadName
            });
            res.end();
        }
    });
};


export const uploadGcodeFile = (req, res) => {
    const file = req.files.file;
    const port = req.body.port;
    const dataSource = req.body.dataSource || PROTOCOL_TEXT;
    const originalName = path.basename(file.name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;

    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            const gcodeHeader = parseGcodeHeader(uploadPath);
            res.send({
                originalName,
                uploadName,
                gcodeHeader
            });
            res.end();
        }
    });
    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        return;
    }
    controller.command(null, 'gcode:loadfile', uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${uploadPath}`);
        }
    });
};

export const uploadUpdateFile = (req, res) => {
    const file = req.files.file;
    const port = req.body.port;
    const dataSource = req.body.dataSource || PROTOCOL_TEXT;
    const originalName = path.basename(file.name);
    const uploadName = pathWithRandomSuffix(originalName);
    const uploadPath = `${DataStorage.tmpDir}/${uploadName}`;
    mv(file.path, uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalName}`);
        } else {
            res.send({
                originalName,
                uploadName
            });
            res.end();
        }
    });
    const controller = store.get(`controllers["${port}/${dataSource}"]`);
    if (!controller) {
        return;
    }
    controller.command(null, 'updatefile', uploadPath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${uploadPath}`);
        }
    });
};
