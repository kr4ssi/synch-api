// ==UserScript==
// @name        ks user
// @namespace   Violentmonkey Scripts
// @include     /https:\/\/o(pen)?load\..*/(f|embed)/*/
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
