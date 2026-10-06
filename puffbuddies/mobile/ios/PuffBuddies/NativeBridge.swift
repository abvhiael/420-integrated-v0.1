import Foundation

final class PuffBuddiesNativeBridge: ObservableObject {
    @Published private(set) var authorityGeneration = 0
    @Published private(set) var signedIn = false
    @Published private(set) var derivedRevision = 0
    private let secureStore = PuffBuddiesSecureSessionStore()

    func restoreSession() { signedIn = secureStore.load() != nil; invalidateDerived() }
    func saveSession(_ token:String) throws { try secureStore.save(token); signedIn = true; invalidateDerived() }
    func signOut() throws { try secureStore.clear(); signedIn = false; authorityGeneration = 0; invalidateDerived() }

    func applyGeneration(_ next:Int) throws {
        if try PuffBuddiesAuthorityPolicy.validateGeneration(current:authorityGeneration,next:next) {
            authorityGeneration=next; invalidateDerived()
        }
    }

    func onResume() { invalidateDerived() }
    func invalidateDerived() { derivedRevision += 1 }

    func validateAppLink(_ url:URL) -> Bool {
        guard url.scheme?.lowercased()=="https" else { return false }
        return ["/matches","/messages","/notifications","/profile","/settings"].contains(url.path)
    }
}
