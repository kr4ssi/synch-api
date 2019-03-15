const express = require('express')
const request = require('request')
const youtubedl = require('@microlink/youtube-dl')
const { getVideoDurationInSeconds } = require('get-video-duration')
const Instagram = require('instagram-nodejs-without-api')
const Insta = new Instagram()
const URL = require('url')
const PATH = require('path')
const crypto = require('crypto')
const forwarded = require('forwarded')
const validUrl = require('valid-url')
const PORT = process.env.PORT || 5001
const STATICS = {}
const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex')
const fixurl = url => {
  if (typeof url === 'undefined') return false
  url = decodeURIComponent(url).replace(/^http:\/\//i, 'https://')
  url = validUrl.isHttpsUri(url)
  if (!url) return false
  url = url.replace(/https:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/')
  return url.replace(/https:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/')
}
express().get('/redir', (req, res) => {
  const url = fixurl(req.query.url)
  if (url && STATICS[url] && STATICS[url].user && STATICS[url].user[md5ip(req)]) res.redirect(STATICS[url].user[md5ip(req)])
  else res.redirect('https://ia801501.us.archive.org/0/items/youtube-yUUjeindT5U/VHS_simple_static_noise_-_Motion_background_loop_1-yUUjeindT5U.mp4')
}).get('/add.json', (req, res) => {
  const url = fixurl(req.query.url)
  if (!url) return res.send({title: 'invalid url'})
  const timestamp = Date.now()
  const hourago = timestamp - (60 * 60 * 1000)
  const sendJson = (jsonObj, cache) => {
    if (!cache) STATICS[url] = {
      jsonObj,
      timestamp,
      user: {}
    }
    if (req.query.userlink) {
      STATICS[url].user[md5ip(req)] = req.query.userlink
      console.log(STATICS[url])
    }
    const newjsonObj = JSON.parse(JSON.stringify(jsonObj))
    if (req.query.redir) newjsonObj.sources[0].url = 'https://' + req.get('host') + '/redir?url=' + url
    if (req.query.title) newjsonObj.title = decodeURIComponent(req.query.title)
    res.send(newjsonObj)
  }
  if (STATICS[url] && STATICS[url].timestamp > hourago) return sendJson(STATICS[url].jsonObj, true)
  const getDurationAndSend = jsonObj => getDuration(jsonObj).then(sendJson).catch(err => res.send({title: 'can\'t get duration'}))
  const jsonObj = {
    title: req.query.title && decodeURIComponent(req.query.title),
    live: req.query.live == "true",
    duration: Number(req.query.duration) || 0,
    sources: [
      {
        url,
        quality: req.query.quality && allowedQuality.includes(Number(req.query.quality)) ? Number(req.query.quality) : 720,
        contentType: req.query.type && decodeURIComponent(req.query.type) || 'application/x-mpegURL'
      }
    ]
  }
  if (url.match(/.*\.m3u8/)) {
    getDurationAndSend(jsonObj)
  }
  else if (url.match(/https?:\/\/(?:www\.)?nxload\.com\/(?:embed-)?(\w+)/i)) {
    request(url.replace(/embed-/i, ''), (err, res, body) => {
      if (err || res.statusCode != 200) return console.error(err || body)
      const regMatch = body.match(/new Clappr\.Player\({\s+sources: \["([^"]+)/i)
      if (regMatch) {
        jsonObj.sources[0].url = regMatch[1].replace(/^http:\/\//i, 'https://')
        jsonObj.title = body.match(/<title>Watch ([^<]+)/i)[1],
        getDurationAndSend(jsonObj)
      }
    })
  }
  else getInfo(url, req.query.info ? '' : jsonObj).then(req.query.info ? info => res.send(info) : getDurationAndSend).catch(err => {
    console.error(err)
    res.send({title: 'can\'t get info'})
  })
}).get('/', (req, res) => {
  res.end()
}).get('/ks.user.js', (req, res) => {
  res.end(require('fs').readFileSync('ks.user.js', {encoding: "utf-8"}))
}).get('/pic.jpg', (req, res) => {
  if (req.query.url && req.query.url.match(/https?:\/\/(www\.)?instagram\.com\/p\/\w+\/?/i)) {
    Insta.getMediaInfoByUrl(req.query.url).then(info => {
      res.redirect(info.thumbnail_url.replace(/^http:\/\//i, 'https://'))
    }).catch(err => console.log(err))
  }
}).use(express.json()).post("/add.json", (req, res) => {
  //res.send(provideUserLink(req.query.url, req.body.url, md5ip(req)))
}).listen(PORT, () => console.log(`Listening on ${ PORT }`))
const allowedQuality = [240, 360, 480, 540, 720, 1080, 1440]
const getDuration = (jsonObj, video) => {
  return new Promise((resolve, reject) => {
    if (jsonObj.live || jsonObj.duration) return resolve(jsonObj)
    let tries = 0
    const tryToGetDuration = err => {
      if (err) console.error(err)
      if (tries > 3) return reject(tries)
      tries++
      getVideoDurationInSeconds(video || jsonObj.sources[0].url).then(duration => {
        Object.assign(jsonObj, {duration})
        resolve(jsonObj)
      }).catch(tryToGetDuration)
    }
    tryToGetDuration()
  })
}
const getInfo = (url, jsonObj) => {
  return new Promise((resolve, reject) => {
    const video = youtubedl(url, ['-U', '--restrict-filenames']).on('error', reject).on('info', info => {
      if (!jsonObj) {
        const out = {}
        Object.keys(info).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}))
        .forEach(key => out[key] = info[key])
        return resolve(out)
      }
      if (!info.title) info = info[0]
      const contentType = ext => {
        const contentType = [
          {type: 'video/mp4', ext: ['.mp4']},
          {type: 'video/webm', ext: ['.webm']},
          {type: 'application/x-mpegURL', ext: ['.m3u8']},
          {type: 'video/ogg', ext: ['.ogv']},
          {type: 'application/dash+xml', ext: ['.mpd']},
          {type: 'audio/aac', ext: ['.aac']},
          {type: 'audio/ogg', ext: ['.ogg']},
          {type: 'audio/mpeg', ext: ['.mp3', '.m4a']}
        ].find(contentType => contentType.ext.includes(ext)) || {}
        return contentType.type
      }
      jsonObj.title = jsonObj.title || info.extractor_key + ' - ' + info.title.replace(new RegExp('^' + info.extractor_key, 'i'))
      if (info.manifest_url) jsonObj.sources[0].url = info.manifest_url.replace(/^http:\/\//i, 'https://')
      else {
        jsonObj.sources[0].url = info.url.replace(/^http:\/\//i, 'https://')
        jsonObj.sources[0].contentType = contentType(PATH.extname(URL.parse(info.url).pathname)) || 'video/mp4'
      }
      if (allowedQuality.includes(info.width)) jsonObj.sources[0].quality = info.width;
      if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) jsonObj.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
      if (!info._duration_raw) return getDuration(jsonObj, video).then(resolve).catch(reject)
      jsonObj.duration = info._duration_raw
      resolve(jsonObj)
    })
  })
}
