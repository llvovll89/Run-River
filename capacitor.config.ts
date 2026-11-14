import type {CapacitorConfig} from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.runriver.app",
    appName: "Run River",
    webDir: "mobile-dist",
    android: {resolveServiceWorkerRequests: false},
    // Ship the UI in the APK so opening the app never requires a remote server.
};

export default config;
