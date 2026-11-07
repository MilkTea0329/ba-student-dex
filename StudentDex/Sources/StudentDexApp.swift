import SwiftUI

@main
struct StudentDexApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .ignoresSafeArea()
                .background(Color(red: 0.933, green: 0.953, blue: 0.980))
        }
    }
}

struct RootView: View {
    var body: some View {
        WebShell()
            .ignoresSafeArea()
    }
}
