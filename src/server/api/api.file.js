import path from 'path';
import mv from 'mv';
import { SERVER_CACHE_IMAGE } from '../constants';
import { pathWithRandomSuffix } from '../lib/random-utils';
import logger from '../lib/logger';

const log = logger('api:file');

export const set = (req, res) => {
    const file = req.files.file;
    const originalFilename = path.basename(file.originalFilename);

    const filename = pathWithRandomSuffix(originalFilename);
    const filePath = `${SERVER_CACHE_IMAGE}/${filename}`;
    console.log('app_cache ', SERVER_CACHE_IMAGE);
    mv(file.path, filePath, (err) => {
        if (err) {
            log.error(`Failed to upload file ${originalFilename}`);
        } else {
            res.send({
                name: originalFilename,
                filename: filename
            });
            res.end();
        }
    });
};
