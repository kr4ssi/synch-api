// ==UserScript==
// @name        openload fürn KS
// @namespace   https://github.com/kr4ssi/synch-api/
// @version     1.0.2
// @author      kr4ssi
// @include     /https?:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\/[^/?#&]+/
// @include     /https?:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\/[^/?#&]+/
// ==/UserScript==

const timer = setInterval(() => {
  let link = `${window.location.protocol}//${window.location.hostname}`
  if (window.location.href.match(/https?:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\/[^/?#&]+/)) {
    let e = document.querySelector("[id^=lqEH1]")
    if (!e) e = document.querySelector("[id^=streamur]")
    if (!e) e = document.querySelector("#mediaspace_wrapper > div:last-child > p:last-child")
    if (!e) e = document.querySelector("#main p:last-child")
    if (!e) return
    if (e.textContent.match(/(HERE IS THE LINK)|(enough for anybody)/)) return
    link += `/stream/${e.textContent}?mime=true`
  }
  else if (window.location.href.match(/https?:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\/[^/?#&]+/)) {
    let e = document.querySelector("[id^=mgvideo_html5_api]")
    if (!e) return
    link = e.src
  }
  if (confirm(`Link "${link}" gefunden. An die Api schicken?`)) window.location.replace(`https://synchapi.herokuapp.com/add.json?url=${window.location.href}&userlink=${link}`)
  clearInterval(timer)
}, 1000)
