package com.runriver.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeRunPlugin.class);
        registerPlugin(NativeMapsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
