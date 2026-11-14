package com.runriver.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Select the exported HTML internally, keeping the browser's public URL unchanged. */
final class StaticPageRequest implements WebResourceRequest {
    private static final Set<String> PAGES = new HashSet<>(Arrays.asList(
        "/running", "/result", "/local-history", "/history", "/settings", "/auth", "/auth/callback", "/maps", "/hiking"
    ));
    private final WebResourceRequest original;
    private final Uri url;
    private StaticPageRequest(WebResourceRequest original, Uri url) { this.original = original; this.url = url; }

    static WebResourceRequest rewrite(WebResourceRequest request, String scheme, String host) {
        Uri url = request.getUrl();
        if (!request.isForMainFrame() || !"GET".equals(request.getMethod()) || !scheme.equals(url.getScheme()) || !host.equals(url.getHost()) || url.getPort() != -1) return request;
        String path = url.getPath();
        if (path == null) return request;
        if (path.endsWith("/")) path = path.substring(0, path.length() - 1);
        if (!PAGES.contains(path)) return request;
        return new StaticPageRequest(request, url.buildUpon().path(path + "/index.html").build());
    }
    @Override public Uri getUrl() { return url; }
    @Override public boolean isForMainFrame() { return original.isForMainFrame(); }
    @Override public boolean isRedirect() { return original.isRedirect(); }
    @Override public boolean hasGesture() { return original.hasGesture(); }
    @Override public String getMethod() { return original.getMethod(); }
    @Override public Map<String, String> getRequestHeaders() { return original.getRequestHeaders(); }
}
