import SwiftUI
import UIKit
import WebKit

/// WKWebView subclass that mirrors the native safe-area insets into CSS custom
/// properties so the layout can hug the notch / home indicator.
final class ShellWebView: WKWebView {
    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        let top = safeAreaInsets.top
        let bottom = safeAreaInsets.bottom
        let js = "document.documentElement.style.setProperty('--safe-t','\(top)px');" +
                 "document.documentElement.style.setProperty('--safe-b','\(bottom)px');"
        evaluateJavaScript(js, completionHandler: nil)
    }
}

struct WebShell: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> ShellWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences

        let webView = ShellWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.933, green: 0.953, blue: 0.980, alpha: 1.0)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.allowsBackForwardNavigationGestures = false

        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            let html = "<html><body style='font-family:-apple-system;padding:40px;text-align:center;color:#666'>" +
                       "<h3>资源缺失</h3><p>未找到 Web/index.html</p></body></html>"
            webView.loadHTMLString(html, baseURL: nil)
        }
        return webView
    }

    func updateUIView(_ uiView: ShellWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        /// Keep the local bundle inside the app; open outside links in Safari.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            if let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                if navigationAction.navigationType == .linkActivated ||
                    navigationAction.targetFrame == nil {
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                    decisionHandler(.cancel)
                    return
                }
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url,
               let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            return nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript(
                "document.documentElement.style.setProperty('--safe-t','\(webView.safeAreaInsets.top)px');" +
                "document.documentElement.style.setProperty('--safe-b','\(webView.safeAreaInsets.bottom)px');",
                completionHandler: nil)
        }
    }
}
