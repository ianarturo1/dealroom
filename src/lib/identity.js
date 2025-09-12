export const identity = {
  init(){
    if (window.netlifyIdentity && !this.inited){
      window.netlifyIdentity.on('init', user => {
        if (!user) {
          // keep
        }
      });
      this.inited = true
    }
  },
  currentUser(){
    return window.netlifyIdentity && window.netlifyIdentity.currentUser()
  },
  async token(){
    const u = this.currentUser()
    if (!u) return null
    return await u.jwt()
  },
  on(event, cb){
    if (window.netlifyIdentity) window.netlifyIdentity.on(event, cb)
  },
  open(){ if (window.netlifyIdentity) window.netlifyIdentity.open() },
  logout(){ if (window.netlifyIdentity) window.netlifyIdentity.logout() }
}
