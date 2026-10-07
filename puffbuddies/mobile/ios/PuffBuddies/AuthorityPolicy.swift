import Foundation

enum PuffBuddiesAuthorityError: Error { case staleGeneration, forbiddenClientAuthority, insecureEndpoint }

struct PuffBuddiesAuthorityPolicy {
    static let baselineActions: Set<String> = ["BLOCK","REPORT","UNMATCH","DEACTIVATE","DELETE_REQUEST"]
    static let forbiddenClientActions: Set<String> = ["FORCE_MATCH","FORCE_UNBLOCK","ADMIN_MATCH","BLOCK_OVERRIDE","UNSUSPEND","UNBAN"]

    static func validateGeneration(current: Int, next: Int) throws -> Bool {
        guard next >= current else { throw PuffBuddiesAuthorityError.staleGeneration }
        return next > current
    }

    static func validateAction(_ action: String) throws {
        if forbiddenClientActions.contains(action) { throw PuffBuddiesAuthorityError.forbiddenClientAuthority }
    }

    static func validateAPI(_ url: URL) throws {
        guard url.scheme?.lowercased() == "https", url.user == nil, url.password == nil, url.host != nil
        else { throw PuffBuddiesAuthorityError.insecureEndpoint }
    }
}
