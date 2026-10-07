package org.fourtwenty.puffbuddies

import java.net.URI

object PuffBuddiesAuthorityPolicy {
    val baselineActions = setOf("BLOCK","REPORT","UNMATCH","DEACTIVATE","DELETE_REQUEST")
    private val forbidden = setOf("FORCE_MATCH","FORCE_UNBLOCK","ADMIN_MATCH","BLOCK_OVERRIDE","UNSUSPEND","UNBAN")

    fun validateGeneration(current:Int,next:Int):Boolean {
        require(next >= current) { "stale authority generation" }
        return next > current
    }
    fun validateAction(action:String) { require(!forbidden.contains(action)) { "mobile client cannot manufacture PuffBuddies authority" } }
    fun validateApi(value:String) {
        val uri=URI(value)
        require(uri.scheme.equals("https",true) && !uri.host.isNullOrBlank() && uri.userInfo == null) { "HTTPS PuffBuddies API required" }
    }
}
