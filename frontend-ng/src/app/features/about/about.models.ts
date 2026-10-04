/** Wire shape of `GET /system/info` (contracts/system-api.md). */
export interface SystemInfo {
  appName: string;
  appVersion: string;
  serverTime: string;
  status: 'ok';
}
