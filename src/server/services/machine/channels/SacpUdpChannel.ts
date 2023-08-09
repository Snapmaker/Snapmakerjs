import { ResponseCallback } from '@snapmaker/snapmaker-sacp-sdk';
import { readUint8 } from '@snapmaker/snapmaker-sacp-sdk/dist/helper';
import dgram from 'dgram';

import { WORKFLOW_STATUS_MAP } from '../../../../app/constants';
import { SACP_TYPE_SERIES_MAP } from '../../../../app/constants/machines';
import logger from '../../../lib/logger';
import Business from '../sacp/Business';
import { FileChannelInterface, UploadFileOptions } from './Channel';
import { ChannelEvent } from './ChannelEvent';
import SacpChannelBase from './SacpChannel';

const log = logger('machine:channel:SacpUdpChannel');

class SacpUdpChannel extends SacpChannelBase implements FileChannelInterface {
    // private client: dgram.
    private socketClient = dgram.createSocket('udp4');

    private heartbeatTimer2 = null;

    public constructor() {
        super();

        this.socketClient.bind(8889, () => {
            log.debug('Bind local port 8889');
        });

        this.socketClient.on('message', (buffer) => {
            // Only when connection is established, then SACP client will be created
            if (this.sacpClient) {
                this.sacpClient.read(buffer);
            }
        });
        this.socketClient.on('close', () => {
            log.info('TCP connection closed');
            const result = {
                code: 200,
                data: {},
                msg: '',
                text: ''
            };
            this.socket && this.socket.emit('connection:close', result);
        });
        this.socketClient.on('error', (err) => {
            log.error(`TCP connection error: ${err}`);
        });
    }

    public async test(host: string, port: number): Promise<boolean> {
        const sacpResponse = (async () => {
            this.sacpClient = new Business('udp', {
                socket: this.socketClient,
                host,
                port,
            });
            this.sacpClient.setLogger(log);

            const { data } = await this.sacpClient.getMachineInfo();
            return !!data;
        })();

        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000));

        return Promise.race([sacpResponse, timeoutPromise]);
    }

    public async connectionOpen(options: { address: string }): Promise<boolean> {
        log.debug(`connectionOpen(): options = ${options}`);

        this.emit(ChannelEvent.Connecting);

        this.sacpClient = new Business('udp', {
            socket: this.socketClient,
            host: options.address,
            port: 2016, // 8889
        });
        this.sacpClient.setLogger(log);

        // Get Machine Info
        const { data: machineInfos } = await this.getMachineInfo();
        const machineIdentifier = SACP_TYPE_SERIES_MAP[machineInfos.type];
        log.debug(`Get machine info, type = ${machineInfos.type}`);
        log.debug(`Get machine info, machine identifier = ${machineIdentifier}`);

        // Once responsed, it's connected
        this.emit(ChannelEvent.Connected);

        // Machine detected
        this.emit(ChannelEvent.Ready, {
            machineIdentifier,
        });

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async connectionClose(options?: { force: boolean }): Promise<boolean> {
        // UDP is stateless, not need to close
        this.sacpClient?.dispose();

        return true;
    }

    public startHeartbeat = async () => {
        log.info('Start heartbeat.');

        const subscribeHeartbeatCallback: ResponseCallback = (data) => {
            if (this.heartbeatTimer2) {
                clearTimeout(this.heartbeatTimer2);
                this.heartbeatTimer2 = null;
            }

            this.heartbeatTimer2 = setTimeout(() => {
                log.info('Lost heartbeat, close connection.');
                this.socket && this.socket.emit('connection:close');
            }, 10000);

            const statusKey = readUint8(data.response.data, 0);

            this.machineStatus = WORKFLOW_STATUS_MAP[statusKey];
            console.log('machine status =', statusKey, this.machineStatus);

            this.socket && this.socket.emit('Marlin:state', {
                state: {
                    status: this.machineStatus,
                }
            });
        };

        const res = await this.sacpClient.subscribeHeartbeat({ interval: 2000 }, subscribeHeartbeatCallback);

        log.info(`Subscribe heartbeat, result = ${res.code}`);
    };

    public stopHeartbeat = async () => {
        const res = await this.sacpClient.unsubscribeHeartbeat(null);

        log.info(`Unsubscribe heartbeat, result = ${res.code}`);
    };

    // interface: FileChannelInterface

    public async uploadFile(options: UploadFileOptions): Promise<boolean> {
        const { filePath, targetFilename } = options;
        log.info(`Upload file to controller... ${filePath}`);

        // Note: Use upload large file API instead of upload file API, newer firmware will implement this API
        // rather than the old ones.
        const res = await this.sacpClient.uploadLargeFile(filePath, targetFilename);

        return (res.response.result === 0);
    }
}

const channel = new SacpUdpChannel();

export {
    channel as sacpUdpChannel
};

export default SacpUdpChannel;
