const ponk = {
  add: function(user, params, meta) {
    const split = params.trim().split(' ');
    const url = split.shift()
    const allowedHosts = [
      'liveleak.com',
      'twitter.com',
      'imgur.com',
      'zdf.de',
      'wdr.de',
      'arte.tv',
      'bandcamp.com',
      'mixcloud.com',
      'archive.org',
      'ccc.de',
      'nxload.com'
    ]
    if (url == '--help') {
      this.sendMessage('Addierbare Hosts: ' + allowedHosts.join(', '))
    }
    else if (url.match(/.*\.m3u8/) || allowedHosts.some(allowed => url.match(new RegExp('^https?:\\/\\/([\\.\\w].)*' + allowed + '\\/.+', 'i')))) {
      let title = split.join(' ');
      if (title) {
        title = '&title=' + title
      }
      const media = {
        'type'     : 'cm',
        'id'       : 'synch-api.herokuapp.com/add.json?url=' + url + title,
        'pos'      : 'end',
        'temp'     : true,
        'duration' : 0
      }
      this.mediaSend(media)
    }
  },
  sendMessage: msg => console.log(msg),
  mediaSend: media => console.log(media)
}
ponk.add('kr4ssi', process.argv.slice(2).join(' '))
