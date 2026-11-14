package com.runriver.app;

import static org.junit.Assert.*;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ActivityController;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class StaticPageRequestTest {
    private WebResourceRequest request(String url, boolean mainFrame) {
        return new WebResourceRequest() {
            public Uri getUrl() { return Uri.parse(url); }
            public boolean isForMainFrame() { return mainFrame; }
            public boolean isRedirect() { return false; }
            public boolean hasGesture() { return true; }
            public String getMethod() { return "GET"; }
            public Map<String, String> getRequestHeaders() { return Collections.singletonMap("X-Test", "retained"); }
        };
    }
    @Test public void selectsExportedPagesAndRetainsQueries() {
        WebResourceRequest rewritten = StaticPageRequest.rewrite(request("https://localhost/result/?id=run-1", true), "https", "localhost");
        assertEquals("https://localhost/result/index.html?id=run-1", rewritten.getUrl().toString());
        assertTrue(rewritten.isForMainFrame()); assertTrue(rewritten.hasGesture());
        assertEquals("retained", rewritten.getRequestHeaders().get("X-Test"));
        assertEquals("/auth/callback/index.html", StaticPageRequest.rewrite(request("https://localhost/auth/callback", true), "https", "localhost").getUrl().getPath());
    }
    @Test public void leavesExternalAndNonDocumentRequestsUnchanged() {
        for (WebResourceRequest original : new WebResourceRequest[]{
            request("https://example.com/running", true), request("http://localhost/running", true),
            request("https://localhost:9999/running", true), request("https://localhost/running", false),
            request("https://localhost/_next/static/app.js", false), request("https://localhost/../private", true),
            request("https://localhost/", true)
        }) assertSame(original, StaticPageRequest.rewrite(original, "https", "localhost"));
    }
    @Test public void capacitorServerServesTheCorrectPackagedHtml() throws Exception {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            assertNotNull(activity.getBridge());
            for (String[] page : new String[][]{{"/running", "운동 기록 준비 중"}, {"/maps/", "산에 가기 전, 지도 준비"}, {"/hiking", "산길에서도 나의 페이스로"}}) {
                WebResourceResponse response = activity.getBridge().getWebViewClient().shouldInterceptRequest(activity.getBridge().getWebView(), request("https://localhost" + page[0], true));
                assertNotNull(response); assertEquals("text/html", response.getMimeType());
                String html = new String(response.getData().readAllBytes(), StandardCharsets.UTF_8);
                assertTrue("Wrong HTML for " + page[0], html.contains(page[1]));
            }
        }
    }
}
