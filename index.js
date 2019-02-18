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
const util = require('util')
const PORT = process.env.PORT || 5001
const STATICS = {}
const md5ip = req => crypto.createHash('md5').update(forwarded(req).pop()).digest('hex')
const fixurl = url => {
  if (typeof url === 'undefined') return false
  url = decodeURIComponent(url)
  url = validUrl.isHttpsUri(url) || validUrl.isHttpUri(url)
  if (!url) return false
  url = url.replace(/https?:\/\/(openload.co|oload\.[a-z0-9-]{2,})\/(f|embed)\//, 'https://openload.co/f/')
  return url.replace(/https?:\/\/(streamango\.com|fruithosts\.net)\/(f|embed)\//, 'https://streamango.com/f/')
}
express().get('/redir', (req, res) => {
  const url = fixurl(req.query.url)
  if (!url) return res.send('invalid url')
  if (STATICS[url] && STATICS[url].userlinks && STATICS[url].userlinks[md5ip(req)]) res.redirect(STATICS[url].userlinks[md5ip(req)])
  else res.redirect('https://ia600700.us.archive.org/26/items/youtube-Hazd5tl37iM/ZDF_Testbild_1988-Hazd5tl37iM.mp4')
}).get('/add.json', (req, res) => {
  const url = fixurl(req.query.url)
  if (!url) return res.send('invalid url')
  const sendJson = jsonObj => {
    if (req.query.userlink) {
      STATICS[url].userlinks[md5ip(req)] = req.query.userlink
      console.log(util.inspect(STATICS))
    }
    if (req.query.redir) {
      const newjsonObj = JSON.parse(JSON.stringify(jsonObj))
      newjsonObj.sources[0].url = 'https://' + req.get('host') + '/redir?url=' + url
      return res.send(newjsonObj)
    }
    res.send(jsonObj)
  }
  const hourago = Date.now() - (60 * 60 * 1000)
  if (typeof STATICS[url] != 'undefined' && STATICS[url].timestamp > hourago) return sendJson(STATICS[url].jsonObj)
  const getDurationAndSend = () => {
    getDuration(jsonObj).then(jsonObj => {
      STATICS[url] = {
        jsonObj,
        timestamp: Date.now(),
        userlinks: {}
      }
      sendJson(jsonObj)
    }).catch(err => res.send('can\'t get duration'))
  }
  const jsonObj = {
    title: decodeURIComponent(req.query.title),
    live: req.query.live == "true",
    duration: Number(req.query.duration) || 0,
    sources: [
      {
        url: url.replace(/^http:\/\//i, 'https://'),
        quality: req.query.quality && allowedQuality.includes(Number(req.query.quality)) ? Number(req.query.quality) : 720,
        contentType: req.query.type && decodeURIComponent(req.query.type) || 'application/x-mpegURL'
      }
    ]
  }
  if (jsonObj.sources[0].url.match(/.*\.m3u8/)) {
    getDurationAndSend()
  }
  else if (jsonObj.sources[0].url.match(/https?:\/\/(www\.)?nxload\.com\/(embed-)?\w+\.html/i)) {
    request(jsonObj.sources[0].url.replace(/embed-/i, ''), (err, res, body) => {
      if (err) return console.error(err)
      if (res.statusCode == 200) {
        const regMatch = body.match(/new Clappr\.Player\({\s+sources: \["([^"]+)/i)
        if (regMatch) {
          jsonObj.sources[0].url = regMatch[1].replace(/^http:\/\//i, 'https://')
          jsonObj.title = body.match(/<title>Watch ([^<]+)/i)[1],
          getDurationAndSend()
        }
      }
    })
  }
  else getInfo(jsonObj).then(jsonObj => {
    getDurationAndSend()
  }).catch(err => {
    console.error(err)
    res.send('can\'t get info')
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
const getDuration = jsonObj => {
  return new Promise((resolve, reject) => {
    if (jsonObj.live || jsonObj.duration) return resolve(jsonObj)
    let tries = 0
    const tryToGetDuration = () => {
      tries++
      getVideoDurationInSeconds(jsonObj.sources[0].url).then(duration => {
        jsonObj.duration = duration
        resolve(jsonObj)
      }).catch(err => {
        console.error(err)
        if (tries > 2) return reject(tries)
        tryToGetDuration()
      })
    }
    tryToGetDuration()
  })
}
const getInfo = (jsonObj) => {
  return new Promise((resolve, reject) => youtubedl.getInfo(jsonObj.sources[0].url, ['-U'], (err, info) => {
    if (err) return reject(err)
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
    if (allowedQuality.includes(info.width)) jsonObj.sources[0].quality = info.width;
    if (info.thumbnail && info.thumbnail.match(/^https?:\/\//i)) jsonObj.thumbnail = info.thumbnail.replace(/^http:\/\//i, 'https://')
    if (info._duration_raw) jsonObj.duration = info._duration_raw
    resolve(jsonObj)
  }))
}
