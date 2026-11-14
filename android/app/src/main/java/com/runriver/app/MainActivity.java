package com.runriver.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeRunPlugin.class);
        registerPlugin(NativeMapsPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null) bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceRequest page = StaticPageRequest.rewrite(request, MainActivity.this.bridge.getScheme(), MainActivity.this.bridge.getConfig().getHostname());
                return super.shouldInterceptRequest(view, page);
            }
        });
    }
}
