const express = require('express')
const request = require('request')
const youtubedl = require('youtube-dl')
const { getVideoDurationInSeconds } = require('get-video-duration')
const Instagram = require('instagram-nodejs-without-api')
const Insta = new Instagram()
const URL = require('url')
const PATH = require('path')
const crypto = require('crypto')
const forwarded = require('forwarded')
const validUrl = require('valid-url')
const PORT = process.env.PORT || 5001
let STATICS = []
const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex')
const oloadReplace = url => url.replace(/https?:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/').replace(/https?:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/')
const provideUserLink = (url, link, ip) => {
  if (!url || (!validUrl.isHttpsUri(url) && !validUrl.isHttpUri(url))) return 'must provide an url'
  url = oloadReplace(url)
  console.log(STATICS)
  STATICS = STATICS.filter(obj => obj.url != url || !obj.ip || obj.ip != ip)
  const autocreated = STATICS.find(obj => obj.url === url)
  if (typeof autocreated != 'undefined') {
    const jsonObj = autocreated.jsonObj
    jsonObj.sources[0].url = link.replace(/^http:\/\//i, 'https://')
    STATICS.push({url, jsonObj, timestamp: Date.now(), ip})
    return jsonObj
  }
  else return 'no data'
}
express().get('/redir', (req, res) => {
  const cache = STATICS.filter(obj => obj.url === req.query.url)
  if (cache.length > 0){
    const user = cache.find(obj => obj.ip === md5ip(req))
    if (typeof user != 'undefined') res.redirect(user.jsonObj.sources[0].url)
    else res.redirect(cache[0].jsonObj.sources[0].url)
  }
  else res.send('not found')
}).use(express.json()).post("/add.json", (req, res) => {
  res.send(provideUserLink(req.query.url, req.body.url, md5ip(req)))
}).get('/add.json', (req, res) => {
  console.log(req.rawHeaders)
  if (req.query.userlink) return res.send(provideUserLink(req.query.url, req.query.userlink, md5ip(req)))
  if (!req.query.url || (!validUrl.isHttpsUri(req.query.url) && !validUrl.isHttpUri(req.query.url))) return res.send('must provide an url')
  const hourago = Date.now() - (60 * 60 * 1000)
  STATICS = STATICS.filter(obj => obj.timestamp > hourago || obj.ip)
  const cache = STATICS.find(obj => obj.url === oloadReplace(req.query.url) && !obj.ip)
  if (typeof cache != 'undefined') {
    const newjsonObj = JSON.parse(JSON.stringify(cache.jsonObj))
    if (req.query.redir) newjsonObj.sources[0].url = 'https://' + req.get('host') + '/redir?url=' + oloadReplace(req.query.url)
    return res.send(newjsonObj)
  }
  let tries = 0
  const tryToGetDurationAndSend = err => {
    const sendOrCreate = () => {
      if (jsonObj.duration > 0) STATICS.push({url: oloadReplace(req.query.url), jsonObj, timestamp: Date.now()})
      const newjsonObj = JSON.parse(JSON.stringify(jsonObj))
      if (req.query.redir) newjsonObj.sources[0].url = 'https://' + req.get('host') + '/redir?url=' + oloadReplace(req.query.url)
      res.send(newjsonObj)
    }
    tries++
    if (err) console.error(err)
    ;((jsonObj.live || jsonObj.duration || tries > 2) ? Promise.resolve() : getVideoDurationInSeconds(jsonObj.sources[0].url).then((duration) => {
      jsonObj.duration = duration
    })).then(sendOrCreate).catch(tryToGetDurationAndSend)
  }
  const allowedQuality = [240, 360, 480, 540, 720, 1080, 1440]
  const jsonObj = {
    title: decodeURIComponent(req.query.title),
    live: req.query.live == "true",
    duration: Number(req.query.duration) || 0,
    sources: [
      {
        url: decodeURIComponent(req.query.url).replace(/^http:\/\//i, 'https://'),
        quality: req.query.quality && allowedQuality.includes(Number(req.query.quality)) ? Number(req.query.quality) : 720,
        contentType: req.query.type && decodeURIComponent(req.query.type) || 'application/x-mpegURL'
      }
    ]
  }
  if (jsonObj.sources[0].url.match(/.*\.m3u8/)) {
    tryToGetDurationAndSend()
  }
  else if (jsonObj.sources[0].url.match(/https?:\/\/(www\.)?nxload\.com\/(embed-)?\w+\.html/i)) {
    request(jsonObj.sources[0].url.replace(/embed-/i, ''), (err, res, body) => {
      if (err) return console.error(err)
      if (res.statusCode == 200) {
        const regMatch = body.match(/new Clappr\.Player\({\s+sources: \["([^"]+)/i)
        if (regMatch) {
          jsonObj.sources[0].url = regMatch[1].replace(/^http:\/\//i, 'https://')
          jsonObj.title = body.match(/<title>Watch ([^<]+)/i)[1],
          tryToGetDurationAndSend()
        }
      }
    })
  }
  else if (jsonObj.sources[0].url.match(/https?:\/\/(www\.)?kinoger\.to\/stream\/[\/-\w]+\.html/i)) {
    request(jsonObj.sources[0].url, (err, res, body) => {
      if (err) return console.error(err)
      if (res.statusCode == 200) {
        let regMatch = body.match(/<div id="kinog-player"><iframe src="https?:\/\/([^"]+)/i)
        if (regMatch) {
          const title = body.match(/<meta property="og:title" content="([^""]+)/i)
          if (title) jsonObj.title = title[1]
          const url = validUrl.isHttpsUri('https://s1.' + regMatch[1])
          if (url) request(url, (err, res, body) => {
            console.log(url, res.statusCode, res.rawHeaders, body)
            if (err) return console.error(err)
            if (res.statusCode == 200) {
              regMatch = body.match(/', type: 'video\/mp4'},{url: \'\/\/([^\']+)/i)
              if (regMatch) {
                jsonObj.sources[0].url = 'https://' + regMatch[1]
                tryToGetDurationAndSend()
              }
            }
          })
        }
      }
    })
  }
  else youtubedl.getInfo(jsonObj.sources[0].url, [], function(err, info) {
    if (err) return console.error(err)
    if (!info.title) info = info[0];
    const contentType = ext => {
      const contentType = [
        {type: 'video/mp4', ext: ['.mp4']},
        {type: 'video/webm', ext: ['.webm']},
        {type: 'application/x-mpegURL', ext: ['.m3u8']},
        {type: 'video/ogg', ext: ['.ogv']},
        {type: 'application/dash+xml', ext: ['.mpd']},
        {type: 'rtmp/flv', ext: ['.flv']},
        {type: 'audio/aac', ext: ['.aac']},
        {type: 'audio/ogg', ext: ['.ogg']},
        {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
      ].find(contentType => contentType.ext.includes(ext))
      if (typeof contentType != 'undefined') return contentType.type
    }
    jsonObj.title = !info.title.toLowerCase().startsWith(info.extractor_key.toLowerCase()) ? info.extractor_key + ' - ' + info.title : info.title
    if (info.manifest_url) jsonObj.sources[0].url = info.manifest_url.replace(/^http:\/\//i, 'https://')
    else {
      jsonObj.sources[0].url = info.url.replace(/^http:\/\//i, 'https://')
      jsonObj.sources[0].contentType = contentType(PATH.extname(URL.parse(jsonObj.sources[0].url).pathname)) || 'video/mp4'
    }
    if (allowedQuality.includes(info.height)) jsonObj.sources[0].quality = info.height;
    if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) jsonObj.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
    if (info._duration_raw) jsonObj.duration = info._duration_raw
    tryToGetDurationAndSend()
  })
}).get('/', (req, res) => {
  res.end()
}).get('/ks.user.js', (req, res) => {
  res.end(require('fs').readFileSync('ks.user.js', {encoding: "utf-8"}))
}).get('/pic.jpg', (req, res) => {
  if (req.query.url && req.query.url.match(/https?:\/\/(www\.)?instagram\.com\/p\/\w+\/?/i)) {
    Insta.getMediaInfoByUrl(req.query.url).then(info => res.redirect(info.thumbnail_url.replace(/^http:\/\//i, 'https://'))).catch(err => console.log(err))
  }
}).get('/page', (req, res) => {
  const Pageres = require('pageres')
  const pageres = new Pageres({delay: 2})
  	.src('https://s1.hdgo.cc/video/t/82fXtwek4LSLmmeOIzzHHhmOa5a2JEc2/762821/', ['1024x768'], {crop: true})
  	.run()
  	.then((data) => data[0].pipe(res));
}).listen(PORT, () => console.log(`Listening on ${ PORT }`))
