// ==UserScript==
// @name        openload fürn KS
// @namespace   https://github.com/kr4ssi/synch-api/
// @version     1.0
// @author      kr4ssi
// @updateURL   https://github.com/kr4ssi/synch-api/blob/master/ks.user.js
// @downloadURL https://github.com/kr4ssi/synch-api/blob/master/ks.user.js
// @include     /https?:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\/.*/
// ==/UserScript==

const timer = setInterval(() => {
  let e = document.querySelector("[id^=streamur]")
  if (!e) e = document.querySelector("#mediaspace_wrapper > div:last-child > p:last-child")
  if (!e) e = document.querySelector("#main p:last-child")
  if (!e) return
  if (e.textContent.match(/(HERE IS THE LINK)|(enough for anybody)/)) return
  const link = `${window.location.protocol}//${window.location.hostname}/stream/${e.textContent}?mime=true`
  if (confirm(`Link "${link}" gefunden. An die Api schicken?`)) window.location.replace(`https://synch-api.herokuapp.com/add.json?url=${window.location.href}&userlink=${link}`)
  clearInterval(timer)
}, 1000)
